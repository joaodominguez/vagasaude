import { cache } from "react";
import { jobs as seedJobs, type Job } from "@/lib/jobs";
import { getJobCard, listJobCards } from "@/lib/job-store";

export type { Job };

/** Tag partilhada para invalidar páginas ISR após ingest/reclassify. */
export const JOBS_CACHE_TAG = "jobs";

/**
 * Soft-expire alvo para HTML ISR (home / detalhe).
 * Os cards vivem no cache em memória do job-store (mtime + TTL 60s) —
 * não usar `unstable_cache` para a lista completa: com ~4k+ vagas o payload
 * ultrapassa o limite de 2MB do Data Cache do Next e entradas vazias ficam presas.
 */
export const JOBS_DATA_REVALIDATE_SECONDS = 120;

function resolveJobs(stored: Job[]): Job[] {
  if (stored.length > 0) return stored;
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return seedJobs;
}

export const getJobs = cache(async (): Promise<Job[]> => {
  const stored = await listJobCards();
  return resolveJobs(stored);
});

export const getJob = cache(
  async (slug: string): Promise<{ job: Job; expired: boolean } | null> => {
    // Sempre o card completo (descrição/requisitos). A lista em memória
    // (`getJobs`) é leve e tem description="" — se a usarmos aqui, o
    // JobPosting JSON-LD fica sem "description" (erro crítico GSC).
    const stored = await getJobCard(slug);
    if (stored) return stored;
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    const seed = seedJobs.find((job) => job.slug === slug);
    if (!seed) return null;
    return { job: seed, expired: false };
  },
);

export async function getJobSlugs(): Promise<string[]> {
  const jobs = await getJobs();
  return jobs.map((job) => job.slug);
}
