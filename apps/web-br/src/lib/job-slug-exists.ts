import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Confirma diretamente no data/jobs.db (consulta indexada, microssegundos) se existe uma vaga
 * com este slug. Usado pelo proxy antes de responder 410 a um slug da lista GONE_JOB_SLUGS:
 * se a vaga voltou a ser publicada com o mesmo slug, o pedido segue normalmente.
 *
 * Na dúvida responde `true` (o pedido segue e dá o 404 de sempre): quando a base não é mantida
 * (JOB_STORE=json), quando não existe ou quando a consulta falha.
 */
type SqliteModule = {
  DatabaseSync: new (
    file: string,
    options?: Record<string, unknown>,
  ) => {
    prepare(sql: string): { get(...params: unknown[]): unknown };
    close(): void;
  };
};

const DB_MAINTAINED = new Set(["dual", "sqlite-dual", "sqlite"]);

export type Db = { prepare(sql: string): { get(...p: unknown[]): unknown; all?(...p: unknown[]): unknown[] }; close(): void };

/** Abre o jobs.db só para leitura; null quando não é mantido, não existe ou o node:sqlite falta. */
export function openJobsDb(): Db | null {
  if (!DB_MAINTAINED.has(process.env.JOB_STORE || "json")) return null;
  const file = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "jobs.db");
  if (!existsSync(file)) return null;
  const get = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
    .getBuiltinModule;
  const sqlite = get?.call(process, "node:sqlite") as SqliteModule | undefined;
  if (!sqlite) return null;
  return new sqlite.DatabaseSync(file, { readOnly: true }) as unknown as Db;
}

export function jobSlugExists(slug: string): boolean {
  try {
    const db = openJobsDb();
    if (!db) return true;
    try {
      return Boolean(db.prepare("SELECT 1 FROM jobs WHERE slug = ? LIMIT 1").get(slug));
    } finally {
      db.close();
    }
  } catch {
    return true;
  }
}

/** Dias depois do fim de uma vaga a partir dos quais a página responde 410 (recuperação BR, 2026-11-14). */
export const EXPIRED_GONE_DAYS = 7;

/**
 * true quando o slug só tem vagas EXPIRADAS (nenhuma publicada/em revisão) e todas foram vistas pela
 * última vez há mais de EXPIRED_GONE_DAYS dias. Nesse caso o proxy responde 410: o Google deixa de
 * gastar rastreio com páginas noindex de vagas encerradas (eram ~26% das visitas do Googlebot) e passa
 * a chegar às vagas novas. Na dúvida (sem base, erro, vaga que voltou) responde false.
 */
export function isStaleExpiredSlug(slug: string, now: number = Date.now()): boolean {
  try {
    const db = openJobsDb();
    if (!db) return false;
    try {
      const row = db
        .prepare(
          `SELECT SUM(status IN ('published','pending_review')) AS live,
                  SUM(status = 'expired') AS expired,
                  MAX(CASE WHEN status = 'expired' THEN last_seen_at END) AS last_seen
             FROM jobs WHERE slug = ?`,
        )
        .get(slug) as { live: number | null; expired: number | null; last_seen: string | null } | undefined;
      if (!row || !row.expired || (row.live ?? 0) > 0 || !row.last_seen) return false;
      const seen = Date.parse(row.last_seen);
      return Number.isFinite(seen) && now - seen > EXPIRED_GONE_DAYS * 86_400_000;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
