import { cache } from "react";
import { jobs as seedJobs, type Job } from "@/lib/jobs";
import { getJobCard, listJobCards } from "@/lib/job-store";

export type { Job };

/**
 * Soft-expire target for HTML ISR (home / detalhe).
 * Os cards em si vivem no cache em memória do job-store (mtime + TTL 60s) —
 * não usar `unstable_cache` para a lista completa: com ~2.5k+ vagas o payload
 * ultrapassa o limite de 2MB do Data Cache do Next e uma entrada vazia `[]`
 * fica “presas” para sempre (revalidação não consegue sobrescrever).
 */
export const JOBS_DATA_REVALIDATE_SECONDS = 120;

function resolveJobs(stored: Job[]): Job[] {
  if (stored.length > 0) return stored;
  // Em produção com DATA_DIR, nunca mascarar falha de leitura com seeds demo.
  if (process.env.NODE_ENV === "production" && process.env.DATA_DIR) {
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
    // Preferir o índice em memória (evita caminho fs no hot path).
    const jobs = await getJobs();
    const active = jobs.find((job) => job.slug === slug);
    if (active) return { job: active, expired: false };

    const stored = await getJobCard(slug);
    if (stored) return stored;
    if (process.env.NODE_ENV === "production" && process.env.DATA_DIR) {
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
