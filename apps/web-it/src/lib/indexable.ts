import type { Job } from "@/lib/jobs";

/**
 * Criterio del sitemap delle offerte (jobs.xml): offerte pubblicate (getJobs) la cui scadenza non
 * cade nelle prossime 72 h. Google legge il jobs.xml fino a 1 giorno dopo e la pagina scaduta
 * sarebbe noindex («noindex in una sitemap» nel GSC). Condiviso da jobs.xml, home e /offerte/oggi.
 */
export const SITEMAP_MARGIN_MS = 72 * 3_600_000;

export function isSitemapJob(
  job: Pick<Job, "expiresAt">,
  now: number = Date.now(),
): boolean {
  const deadline = job.expiresAt ? Date.parse(job.expiresAt) : NaN;
  return Number.isNaN(deadline) || deadline > now + SITEMAP_MARGIN_MS;
}
