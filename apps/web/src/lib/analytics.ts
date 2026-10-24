import type { Job } from "@/lib/jobs";

/**
 * Atributos dos links de candidatura lidos pelo GoogleAnalyticsTracker, que
 * envia o evento GA4 "apply_click" (cliques em "Candidate-se" / edital).
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
