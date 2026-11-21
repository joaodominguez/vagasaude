import { cache } from "react";
import { jobs as seedJobs, type Job } from "@/lib/jobs";
import { decodeHtmlEntities, getJobCard, listAllStoredJobs, listJobCards } from "@/lib/job-store";
import { countEmployerHistory, hasEmployerHistory, setEmployerHistory } from "@/lib/employers";

export type { Job };

/**
 * Soft-expire target per l'ISR dell'HTML (home / dettaglio).
 * Le card vivono nella cache in memoria del job-store (mtime + TTL 60s):
 * non usare `unstable_cache` per l'elenco completo: con migliaia di offerte il payload
 * supera il limite di 2MB della Data Cache di Next e una voce vuota `[]`
 * resta "bloccata" per sempre (la revalidazione non riesce a sovrascriverla).
 */
export const JOBS_DATA_REVALIDATE_SECONDS = 120;

function resolveJobs(stored: Job[]): Job[] {
  if (stored.length > 0) return stored;
  // In produzione (build ISR o runtime) non mascherare mai l'assenza di dati
  // con le offerte demo: in passato ha portato a pubblicare home e `/offerte` con i seed.
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return seedJobs;
}

/** Registra lo storico delle offerte per ente (pagine ente con isteresi, vedi employers.ts). */
async function withEmployerHistory(jobs: Job[]): Promise<Job[]> {
  if (!hasEmployerHistory(jobs)) {
    const stored = await listAllStoredJobs();
    setEmployerHistory(
      jobs,
      countEmployerHistory(
        stored.map((job) => ({
          company: decodeHtmlEntities(job.company),
          status: job.status,
          lastSeenAt: job.lastSeenAt,
          updatedAt: job.updatedAt,
        })),
      ),
    );
  }
  return jobs;
}

export const getJobs = cache(async (): Promise<Job[]> => {
  const stored = await listJobCards();
  return withEmployerHistory(resolveJobs(stored));
});

export const getJob = cache(
  async (
    slug: string,
  ): Promise<{
    job: Job;
    expired: boolean;
    canonicalSlug?: string;
    closure?: { at: number; kind: "deadline" | "gone" } | null;
  } | null> => {
    // Preferire l'indice in memoria (evita l'accesso al filesystem nel percorso caldo).
    const jobs = await getJobs();
    const active = jobs.find((job) => job.slug === slug);
    if (active) return { job: active, expired: false };

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
