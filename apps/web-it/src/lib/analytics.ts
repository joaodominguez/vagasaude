import type { Job } from "@/lib/jobs";

/**
 * Attributi dei link di candidatura letti da GoogleAnalyticsTracker, che
 * invia l'evento GA4 "apply_click" (clic su "Candidati" / bando).
 */
export function applyTrackingProps(job: Job, placement: string) {
  return {
    "data-apply": placement,
    "data-job-slug": job.slug,
    "data-job-company": job.company,
    "data-job-profession": job.profession,
    "data-job-district": job.district,
    "data-job-source": job.source ?? "",
  };
}
