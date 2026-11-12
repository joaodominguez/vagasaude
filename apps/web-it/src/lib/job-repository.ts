/**
 * Archiviazione delle offerte (uguale sui siti PT, BR, ES e IT).
 *
 * Il job-store lavora sempre sull'elenco completo in memoria; questo modulo sa solo
 * leggere e scrivere quell'elenco. Implementazioni:
 *  - JSON   (data/jobs.json)  — il formato storico; resta quello predefinito.
 *  - SQLite (data/jobs.db)    — una riga per offerta (record JSON completo + colonne
 *    indicizzate), nella stessa posizione dell'elenco; ogni scrittura salva solo le righe
 *    cambiate, in una transazione.
 *
 * JOB_STORE sceglie la combinazione (senza variabile = "json", comportamento di sempre):
 *   json        legge/scrive solo jobs.json
 *   dual        legge jobs.json; scrive jobs.json e replica su jobs.db (un errore nella replica
 *               non pregiudica il sito, viene solo registrato)
 *   sqlite-dual legge jobs.db; scrive jobs.db e mantiene jobs.json (strumenti Python)
 *   sqlite      legge/scrive solo jobs.db
 *
 * Resta autosufficiente (solo moduli di Node) in modo che gli strumenti da riga di
 * comando possano importarlo direttamente con Node 24.
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
  /** Marcatore che cambia a ogni scrittura. Lancia un errore con code "ENOENT" se non ci sono ancora dati. */
  version(): Promise<number>;
  /** Legge tutto (l'ordine dell'elenco è preservato). */
  load(): Promise<JobsFile<J>>;
  /** Scrive l'elenco completo (atomico). */
  save(file: JobsFile<J>): Promise<void>;
}

export function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function notFound(what: string) {
  const error = new Error(`${what} non esiste`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Copie giornaliere (le più recenti): rete di sicurezza contro le perdite. */
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
      return; // jobs.json non esiste ancora (prima scrittura)
    }
    await pruneDailyBackups(this.filePath);
  }

  async save(file: JobsFile<J>) {
    const filePath = this.filePath;
    await mkdir(path.dirname(filePath), { recursive: true });
    await this.backupDaily();
    // Scrittura atomica (temporaneo + rename): nessuna lettura trova il file a metà.
    // Mantiene proprietario e permessi del file precedente (l'app gira come root).
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

/** Il minimo dell'API node:sqlite (Node ≥ 22.13) usato qui. */
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
  // getBuiltinModule invece di import: la build (Node 20 su Mac) non prova mai a risolvere
  // node:sqlite; viene caricato solo a runtime quando JOB_STORE lo richiede.
  const get = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
    .getBuiltinModule;
  const mod = get?.call(process, "node:sqlite") as SqliteModule | undefined;
  if (!mod) throw new Error(`node:sqlite non disponibile in questo Node (${process.version})`);
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
  /** Corpo (JSON) di ogni posizione nell'ultima versione letta/scritta: per scrivere solo ciò che è cambiato. */
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

  /** Base nuova: stesso proprietario/permessi del jobs.json accanto (l'app gira come root). */
  private matchOwner() {
    try {
      const ref = statSync(path.join(path.dirname(this.filePath), "jobs.json"));
      chmodSync(this.filePath, ref.mode & 0o777);
      chownSync(this.filePath, ref.uid, ref.gid);
    } catch {
      // nessun riferimento: resta com'è stato creato
    }
  }

  private readVersion(db: SqliteDatabase): number | null {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'version'").get();
    return row ? Number(row.value) : null;
  }

  async version() {
    const v = this.readVersion(this.open(false));
    if (v === null) throw notFound(`${this.filePath} (vuoto)`);
    return v;
  }

  async load() {
    const db = this.open(false);
    db.exec("BEGIN");
    try {
      const version = this.readVersion(db);
      if (version === null) throw notFound(`${this.filePath} (vuoto)`);
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

  /** Copia consistente del giorno (VACUUM INTO), prima della prima scrittura di ogni giorno. */
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
      // resta com'è stato creato
    }
    await pruneDailyBackups(this.filePath);
  }
}

// ---------------------------------------------------------------- combinazioni

/** Legge dal principale; scrive sul principale e poi sul secondario. */
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
        `[job-store] ATTENZIONE: copia su ${this.secondary.kind} non scritta: ${(cause as Error).message}`,
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
      // Gli strumenti Python leggono ancora jobs.json: se questa copia fallisce, segnalarlo con decisione.
      return new MirroredJobRepository<J>(
        new SqliteJobRepository<J>(),
        new JsonJobRepository<J>(),
        true,
      );
    case "sqlite":
      return new SqliteJobRepository<J>();
    default:
      throw new Error(`JOB_STORE sconosciuto: ${mode}`);
  }
}
