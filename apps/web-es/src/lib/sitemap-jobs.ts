import type { Job } from "@/lib/jobs";
import { getJobs } from "@/lib/jobs-data";
import { MAX_JOB_AGE_DAYS, MAX_UNSEEN_DAYS } from "@/lib/job-store";

/**
 * Margen de seguridad del sitemap de ofertas (2026-11-20; antes solo el prazo, commit d999e1a): el
 * Google lee el jobs.xml hasta 1 día después de generado (y la caché aguanta hasta 6 h) y la oferta
 * puede estar ya cerrada (noindex) → el GSC avisa «noindex en un mapa del sitio» y la Indexing API
 * gasta cuota. Fuera del sitemap (y de la Indexing API/IndexNow) quedan las ofertas cuyo plazo cae en
 * las próximas 72 h (incluidos plazos ya pasados) y las que dentro de esas 72 h dejarán de estar
 * activas (sin verlas el scraper > 7 días, o publicadas hace > 1 año sin plazo futuro).
 */
export const SITEMAP_MARGIN_MS = 72 * 3_600_000;
const DAY_MS = 86_400_000;

/** Oferta que seguirá indexable (activa, sin noindex) dentro de 72 h. En ES solo caduca por fechas. */
export function isSitemapJob(
  job: Pick<Job, "publishedAt" | "expiresAt" | "lastSeenAt">,
  now: number = Date.now(),
): boolean {
  const horizon = now + SITEMAP_MARGIN_MS;
  const lastSeen = job.lastSeenAt ? Date.parse(job.lastSeenAt) : Number.NaN;
  if (!Number.isNaN(lastSeen) && horizon - lastSeen > MAX_UNSEEN_DAYS * DAY_MS) return false;
  const deadline = job.expiresAt ? Date.parse(job.expiresAt) : Number.NaN;
  if (!Number.isNaN(deadline)) return deadline > horizon;
  const published = Date.parse(job.publishedAt);
  return Number.isNaN(published) || horizon - published <= MAX_JOB_AGE_DAYS * DAY_MS;
}

/**
 * Profesiones clínicas (las que más buscan los candidatos y más peso tienen para Google for Jobs).
 * Fuera: Técnico de farmacia, Óptica y audiología, Veterinaria, Trabajo social, Celador,
 * Gestión y apoyo, Administrativo, Formación y Otros.
 */
const CLINICAL_PROFESSIONS = new Set([
  "Enfermería",
  "Medicina",
  "Fisioterapia",
  "Farmacia",
  "TCAE",
  "Técnico sanitario",
  "Odontología",
  "Psicología",
  "Nutrición",
]);

export function isClinicalJob(job: Pick<Job, "profession">): boolean {
  return CLINICAL_PROFESSIONS.has(job.profession);
}

/**
 * Fuentes de bajo valor: ofertas sindicadas que ya están en muchos portales y sin nombre de empresa
 * (SNE = «Empresa anunciante (vía Sistema Nacional de Empleo)», ~24 % de las publicadas).
 */
const SYNDICATED_SOURCES = new Set(["sne"]);

/** Ofertas del jobs.xml (y, por arrastre, de la Indexing API e IndexNow, que leen este sitemap). */
export async function listSitemapJobs(now: number = Date.now()): Promise<Job[]> {
  return (await getJobs()).filter((job) => isSitemapJob(job, now));
}

/** lastmod de una oferta: la publicación; sin fecha válida, la 1.ª vez vista; nunca «ahora». */
export function jobLastmod(job: Job, now: number = Date.now()): Date | null {
  for (const value of [job.publishedAt, job.firstSeenAt]) {
    const t = value ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(t) && t <= now) return new Date(t);
  }
  return null;
}

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Metadatos para la cola de la Indexing API/IndexNow (tools/indexing_notify.py): solo datos que ya
 * son públicos en la página. siblings = nº de ofertas del sitemap con la misma empresa+título+ciudad
 * (1 = única); sourceCount = ofertas del sitemap de la misma fuente (pequeña = fuente rara);
 * syndicated = fuente de bajo valor (ver SYNDICATED_SOURCES).
 */
export function buildJobsMeta(jobs: Job[], siteUrl: string, now: number = Date.now()) {
  const keyOf = (job: Job) =>
    `${normalizeKey(job.company)}|${normalizeKey(job.title)}|${normalizeKey(job.city)}`;
  const siblings = new Map<string, number>();
  const sources = new Map<string, number>();
  for (const job of jobs) {
    siblings.set(keyOf(job), (siblings.get(keyOf(job)) ?? 0) + 1);
    const source = job.source ?? "";
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }
  return jobs.map((job) => ({
    url: `${siteUrl}/empleo/${job.slug}`,
    lastmod: (jobLastmod(job, now) ?? new Date(now)).toISOString(),
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt ?? null,
    expiresAt: job.expiresAt ?? null,
    source: job.source ?? "",
    profession: job.profession,
    clinical: isClinicalJob(job),
    syndicated: SYNDICATED_SOURCES.has(job.source ?? ""),
    siblings: siblings.get(keyOf(job)) ?? 1,
    sourceCount: sources.get(job.source ?? "") ?? 1,
  }));
}
