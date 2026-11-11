/**
 * Armazenamento das vagas (igual nos 3 sites: PT, BR, ES).
 *
 * O job-store trabalha sempre sobre a lista completa em memória; este módulo só
 * sabe ler e gravar essa lista. Implementações:
 *  - JSON   (data/jobs.json)  — o formato histórico; continua a ser o padrão.
 *  - SQLite (data/jobs.db)    — uma linha por vaga (registo JSON completo + colunas
 *    indexadas), na mesma posição da lista; cada gravação só escreve as linhas que
 *    mudaram, numa transação.
 *
 * JOB_STORE escolhe a combinação (sem variável = "json", comportamento de sempre):
 *   json        lê/grava só o jobs.json
 *   dual        lê o jobs.json; grava o jobs.json e espelha no jobs.db (falha no espelho
 *               não afeta o site, só fica registada)
 *   sqlite-dual lê o jobs.db; grava o jobs.db e mantém o jobs.json (ferramentas Python)
 *   sqlite      lê/grava só o jobs.db
 *
 * Mantém-se autossuficiente (só módulos do Node) para as ferramentas de linha de
 * comando o poderem importar diretamente com o Node 24.
 */
import {
  chmod,
  chown,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { existsSync, statSync, chmodSync, chownSync } from "node:fs";
import path from "node:path";

export type JobsFile<J = unknown> = {
  updatedAt: string;
  jobs: J[];
};

export interface JobRepository<J = unknown> {
  readonly kind: string;
  /** Marca que muda a cada gravação. Lança um erro com code "ENOENT" se ainda não há dados. */
  version(): Promise<number>;
  /** Lê tudo (a ordem da lista é preservada). */
  load(): Promise<JobsFile<J>>;
  /** Grava a lista completa (atómico). */
  save(file: JobsFile<J>): Promise<void>;
}

export function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function notFound(what: string) {
  const error = new Error(`${what} não existe`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Cópias diárias (as mais recentes) — rede de segurança contra perdas. */
const DAILY_BACKUPS_KEPT = 7;

async function pruneDailyBackups(filePath: string) {
  const dir = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.bak-daily-`;
  const old = (await readdir(dir))
    .filter((name) => name.startsWith(prefix))
    .sort()
    .slice(0, -DAILY_BACKUPS_KEPT);
  await Promise.all(
    old.map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

// ---------------------------------------------------------------- JSON

export class JsonJobRepository<J = unknown> implements JobRepository<J> {
  readonly kind = "json";
  private readonly filePath: string;
  constructor(filePath = path.join(dataDir(), "jobs.json")) {
    this.filePath = filePath;
  }

  async version() {
    return (await stat(this.filePath)).mtimeMs;
  }

  async load() {
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw) as JobsFile<J>;
  }

  private async backupDaily() {
    const backup = `${this.filePath}.bak-daily-${today()}`;
    if (await stat(backup).then(() => true, () => false)) return;
    try {
      await copyFile(this.filePath, backup);
    } catch {
      return; // ainda não existe jobs.json (1.ª escrita)
    }
    await pruneDailyBackups(this.filePath);
  }

  async save(file: JobsFile<J>) {
    const filePath = this.filePath;
    await mkdir(path.dirname(filePath), { recursive: true });
    await this.backupDaily();
    // Escrita atómica (temporário + rename): nenhuma leitura apanha o ficheiro a meio.
    // Mantém dono e permissões do ficheiro anterior (a app corre como root).
    const before = await stat(filePath).catch(() => null);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, JSON.stringify(file, null, 2), { mode: 0o600 });
    if (before) {
      await chmod(tmpPath, before.mode & 0o777);
      await chown(tmpPath, before.uid, before.gid).catch(() => undefined);
    }
    await rename(tmpPath, filePath);
  }
}

// ---------------------------------------------------------------- SQLite

/** O mínimo da API node:sqlite (Node ≥ 22.13) usado aqui. */
type SqliteStatement = {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
};
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};
type SqliteModule = {
  DatabaseSync: new (file: string, options?: Record<string, unknown>) => SqliteDatabase;
};

function loadSqlite(): SqliteModule {
  // getBuiltinModule em vez de import: o build (Node 20 no Mac) nunca tenta resolver
  // node:sqlite; só é carregado em runtime quando JOB_STORE o pede.
  const get = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
    .getBuiltinModule;
  const mod = get?.call(process, "node:sqlite") as SqliteModule | undefined;
  if (!mod) throw new Error(`node:sqlite indisponível neste Node (${process.version})`);
  return mod;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (
  pos INTEGER PRIMARY KEY,
  id TEXT,
  slug TEXT,
  source TEXT,
  source_id TEXT,
  status TEXT,
  dedupe_hash TEXT,
  published_at TEXT,
  expires_at TEXT,
  last_seen_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_slug ON jobs(slug);
CREATE INDEX IF NOT EXISTS jobs_source ON jobs(source, source_id);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_id ON jobs(id);
`;

function col(job: unknown, key: string): string | null {
  const value = (job as Record<string, unknown> | null)?.[key];
  return value === undefined || value === null ? null : String(value);
}

export class SqliteJobRepository<J = unknown> implements JobRepository<J> {
  readonly kind = "sqlite";
  private readonly filePath: string;
  private db: SqliteDatabase | null = null;
  /** Corpo (JSON) de cada posição na última versão lida/gravada — para gravar só o que mudou. */
  private bodies: string[] | null = null;
  private bodiesVersion = -1;

  constructor(filePath = path.join(dataDir(), "jobs.db")) {
    this.filePath = filePath;
  }

  private open(create: boolean): SqliteDatabase {
    if (this.db) return this.db;
    const existed = existsSync(this.filePath);
    if (!existed && !create) throw notFound(this.filePath);
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(this.filePath);
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec(SCHEMA);
    if (!existed) this.matchOwner();
    this.db = db;
    return db;
  }

  /** Base nova: mesmo dono/permissões do jobs.json ao lado (a app corre como root). */
  private matchOwner() {
    try {
      const ref = statSync(path.join(path.dirname(this.filePath), "jobs.json"));
      chmodSync(this.filePath, ref.mode & 0o777);
      chownSync(this.filePath, ref.uid, ref.gid);
    } catch {
      // sem referência: fica como foi criado
    }
  }

  private readVersion(db: SqliteDatabase): number | null {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'version'").get();
    return row ? Number(row.value) : null;
  }

  async version() {
    const v = this.readVersion(this.open(false));
    if (v === null) throw notFound(`${this.filePath} (vazio)`);
    return v;
  }

  async load() {
    const db = this.open(false);
    db.exec("BEGIN");
    try {
      const version = this.readVersion(db);
      if (version === null) throw notFound(`${this.filePath} (vazio)`);
      const updatedAt = String(
        db.prepare("SELECT value FROM meta WHERE key = 'updatedAt'").get()?.value ?? "",
      );
      const rows = db.prepare("SELECT body FROM jobs ORDER BY pos").all();
      const bodies = rows.map((row) => String(row.body));
      this.bodies = bodies;
      this.bodiesVersion = version;
      return { updatedAt, jobs: bodies.map((body) => JSON.parse(body) as J) };
    } finally {
      db.exec("COMMIT");
    }
  }

  async save(file: JobsFile<J>) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await this.backupDaily();
    const db = this.open(true);
    const next = file.jobs.map((job) => JSON.stringify(job));
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readVersion(db) ?? 0;
      let previous = this.bodies;
      if (!previous || this.bodiesVersion !== current) {
        previous = [];
        for (const row of db.prepare("SELECT pos, body FROM jobs ORDER BY pos").all()) {
          previous[Number(row.pos)] = String(row.body);
        }
      }
      const upsert = db.prepare(
        `INSERT OR REPLACE INTO jobs
          (pos, id, slug, source, source_id, status, dedupe_hash, published_at,
           expires_at, last_seen_at, created_at, updated_at, body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (let pos = 0; pos < next.length; pos += 1) {
        if (previous[pos] === next[pos]) continue;
        const job = file.jobs[pos];
        upsert.run(
          pos,
          col(job, "id"),
          col(job, "slug"),
          col(job, "source"),
          col(job, "sourceId"),
          col(job, "status"),
          col(job, "dedupeHash"),
          col(job, "publishedAt"),
          col(job, "expiresAt"),
          col(job, "lastSeenAt"),
          col(job, "createdAt"),
          col(job, "updatedAt"),
          next[pos],
        );
      }
      if (previous.length > next.length) {
        db.prepare("DELETE FROM jobs WHERE pos >= ?").run(next.length);
      }
      const setMeta = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
      setMeta.run("updatedAt", file.updatedAt ?? "");
      setMeta.run("version", String(current + 1));
      db.exec("COMMIT");
      this.bodies = next;
      this.bodiesVersion = current + 1;
    } catch (error) {
      db.exec("ROLLBACK");
      this.bodies = null;
      throw error;
    }
  }

  /** Cópia consistente do dia (VACUUM INTO), antes da 1.ª gravação de cada dia. */
  private async backupDaily() {
    if (!existsSync(this.filePath)) return;
    const backup = `${this.filePath}.bak-daily-${today()}`;
    if (existsSync(backup)) return;
    const db = this.open(false);
    db.prepare("VACUUM INTO ?").run(backup);
    try {
      const ref = statSync(this.filePath);
      chmodSync(backup, ref.mode & 0o777);
      chownSync(backup, ref.uid, ref.gid);
    } catch {
      // mantém-se como foi criado
    }
    await pruneDailyBackups(this.filePath);
  }
}

// ---------------------------------------------------------------- combinações

/** Lê do principal; grava no principal e depois no secundário. */
class MirroredJobRepository<J> implements JobRepository<J> {
  readonly kind: string;
  private readonly primary: JobRepository<J>;
  private readonly secondary: JobRepository<J>;
  private readonly secondaryIsCritical: boolean;

  constructor(primary: JobRepository<J>, secondary: JobRepository<J>, secondaryIsCritical: boolean) {
    this.primary = primary;
    this.secondary = secondary;
    this.secondaryIsCritical = secondaryIsCritical;
    this.kind = `${primary.kind}+${secondary.kind}`;
  }

  version() {
    return this.primary.version();
  }

  load() {
    return this.primary.load();
  }

  async save(file: JobsFile<J>) {
    await this.primary.save(file);
    try {
      await this.secondary.save(file);
    } catch (cause) {
      if (this.secondaryIsCritical) throw cause;
      console.warn(
        `[job-store] AVISO: cópia em ${this.secondary.kind} não gravada: ${(cause as Error).message}`,
      );
    }
  }
}

export function createJobRepository<J = unknown>(
  mode = process.env.JOB_STORE || "json",
): JobRepository<J> {
  switch (mode) {
    case "json":
      return new JsonJobRepository<J>();
    case "dual":
      return new MirroredJobRepository<J>(
        new JsonJobRepository<J>(),
        new SqliteJobRepository<J>(),
        false,
      );
    case "sqlite-dual":
      // As ferramentas Python ainda leem o jobs.json: se essa cópia falhar, avisar a sério.
      return new MirroredJobRepository<J>(
        new SqliteJobRepository<J>(),
        new JsonJobRepository<J>(),
        true,
      );
    case "sqlite":
      return new SqliteJobRepository<J>();
    default:
      throw new Error(`JOB_STORE desconhecido: ${mode}`);
  }
}
