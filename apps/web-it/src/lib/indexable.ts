import type { Job } from "@/lib/jobs";
import { MAX_JOB_AGE_DAYS, MAX_UNSEEN_DAYS } from "@/lib/job-store";

/**
 * Criterio del sitemap delle offerte (jobs.xml): offerte pubblicate (getJobs) che resteranno
 * indicizzabili (attive, senza noindex) tra 72 h. Google legge il jobs.xml fino a 1 giorno dopo
 * (e la cache regge 6 h): la pagina scaduta e' noindex («noindex in una sitemap» nel GSC) e la
 * Indexing API sprecherebbe quota. Restano fuori (e quindi fuori da Indexing API e IndexNow, che
 * leggono questo sitemap):
 *  - offerte con scadenza (expiresAt) entro 72 h, comprese quelle gia' scadute;
 *  - offerte senza scadenza che la fonte non restituisce da oltre 7 giorni entro 72 h (TTL
 *    lastSeenAt, uguale a isInactive nel job-store) o pubblicate da oltre 1 anno.
 * Condiviso da jobs.xml, jobs-meta.json, home e /offerte/oggi.
 */
export const SITEMAP_MARGIN_MS = 72 * 3_600_000;
const DAY_MS = 86_400_000;

export function isSitemapJob(
  job: Pick<Job, "expiresAt"> & Partial<Pick<Job, "publishedAt" | "lastSeenAt">>,
  now: number = Date.now(),
): boolean {
  const horizon = now + SITEMAP_MARGIN_MS;
  const lastSeen = job.lastSeenAt ? Date.parse(job.lastSeenAt) : Number.NaN;
  if (!Number.isNaN(lastSeen) && horizon - lastSeen > MAX_UNSEEN_DAYS * DAY_MS) return false;
  const deadline = job.expiresAt ? Date.parse(job.expiresAt) : Number.NaN;
  if (!Number.isNaN(deadline)) return deadline > horizon;
  const published = job.publishedAt ? Date.parse(job.publishedAt) : Number.NaN;
  return Number.isNaN(published) || horizon - published <= MAX_JOB_AGE_DAYS * DAY_MS;
}
