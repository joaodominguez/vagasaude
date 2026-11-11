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

export function jobSlugExists(slug: string): boolean {
  if (!DB_MAINTAINED.has(process.env.JOB_STORE || "json")) return true;
  const file = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "jobs.db");
  if (!existsSync(file)) return true;
  try {
    const get = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
      .getBuiltinModule;
    const sqlite = get?.call(process, "node:sqlite") as SqliteModule | undefined;
    if (!sqlite) return true;
    const db = new sqlite.DatabaseSync(file, { readOnly: true });
    try {
      return Boolean(db.prepare("SELECT 1 FROM jobs WHERE slug = ? LIMIT 1").get(slug));
    } finally {
      db.close();
    }
  } catch {
    return true;
  }
}
