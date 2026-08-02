import { jobs as seedJobs, type Job } from "@/lib/jobs";
import { getJobCard, listJobCards } from "@/lib/job-store";

export type { Job };

export async function getJobs(): Promise<Job[]> {
  const stored = await listJobCards();
  if (stored.length > 0) return stored;
  return seedJobs;
}

export async function getJob(slug: string): Promise<Job | null> {
  const stored = await getJobCard(slug);
  if (stored) return stored;
  return seedJobs.find((job) => job.slug === slug) ?? null;
}

export async function getJobSlugs(): Promise<string[]> {
  const jobs = await getJobs();
  return jobs.map((job) => job.slug);
}
