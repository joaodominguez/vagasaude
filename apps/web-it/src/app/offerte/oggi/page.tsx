import type { Metadata } from "next";
import { RecentJobsView } from "@/components/recent-jobs-view";
import { getJobs } from "@/lib/jobs-data";
import { buildRecentMetadata, listRecentJobs } from "@/lib/recent-jobs";

// ISR come le categorie: jobs.json cambia a ogni raccolta (6 h) e l'HTML si rinfresca ogni 10 min.
// package-web-it.sh toglie il prerender del build (servono i dati reali del VPS).
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildRecentMetadata(listRecentJobs(await getJobs()));
}

export default async function RecentJobsPage() {
  const allJobs = await getJobs();
  return <RecentJobsView set={listRecentJobs(allJobs)} allJobs={allJobs} />;
}
