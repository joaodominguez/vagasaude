/**
 * lastmod dos sitemaps (A2, 2026-11-22): só datas plausíveis e estáveis.
 * Inválido = não parsável, anterior a 2020-01-01 ou mais de 1 dia no futuro (ex.: "1099-12-31"
 * vindo de uma data de publicação mal lida na fonte).
 */
export const LASTMOD_MIN_MS = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;

/** Instante (ms) se a data for um lastmod válido; senão null. */
export function validLastmodMs(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t) || t < LASTMOD_MIN_MS || t > now + DAY_MS) return null;
  return t;
}

/** Primeira data válida da lista (publicação, depois createdAt/firstSeenAt); null se nenhuma servir. */
export function pickLastmod(values: Array<string | null | undefined>, now: number = Date.now()): Date | null {
  for (const value of values) {
    const t = validLastmodMs(value, now);
    if (t != null) return new Date(t);
  }
  return null;
}

/**
 * Uma entrada por slug (A3): slugs truncados a 100 caracteres podem coincidir entre vagas diferentes e
 * o sitemap repetia o URL. Mantém a primeira, que é a que a página mostra (jobs-data.getJob usa find()).
 */
export function dedupeBySlug<T extends { slug: string }>(jobs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const job of jobs) {
    if (seen.has(job.slug)) continue;
    seen.add(job.slug);
    out.push(job);
  }
  return out;
}
