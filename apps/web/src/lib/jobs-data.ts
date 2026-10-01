import { unstable_cache } from "next/cache";
import { cache } from "react";
import { jobs as seedJobs, type Job } from "@/lib/jobs";
import { getJobCard, listJobCards } from "@/lib/job-store";

export type { Job };

/** Tag partilhada para invalidar o Data Cache no ingest/reclassify. */
export const JOBS_CACHE_TAG = "jobs";

/** Soft-expire: ingest aparece em ≤2 min; HTML ISR alinhado em 10 min. */
export const JOBS_DATA_REVALIDATE_SECONDS = 120;

const loadJobCards = unstable_cache(
  async () => listJobCards(),
  ["pt-job-cards"],
  {
    revalidate: JOBS_DATA_REVALIDATE_SECONDS,
    tags: [JOBS_CACHE_TAG],
  },
);

export const getJobs = cache(async (): Promise<Job[]> => {
  const stored = await loadJobCards();
  if (stored.length > 0) return stored;
  return seedJobs;
});

export const getJob = cache(
  async (slug: string): Promise<{ job: Job; expired: boolean } | null> => {
    // Preferir o Data Cache de cards (evita caminho fs no hot path).
    const jobs = await getJobs();
    const active = jobs.find((job) => job.slug === slug);
    if (active) return { job: active, expired: false };

    const stored = await getJobCard(slug);
    if (stored) return stored;
    const seed = seedJobs.find((job) => job.slug === slug);
    if (!seed) return null;
    return { job: seed, expired: false };
  },
);

export async function getJobSlugs(): Promise<string[]> {
  const jobs = await getJobs();
  return jobs.map((job) => job.slug);
}
