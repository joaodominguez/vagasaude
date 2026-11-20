import type { Metadata } from "next";
import { RecentJobsView } from "@/components/recent-jobs-view";
import { getJobs } from "@/lib/jobs-data";
import { buildRecentMetadata, listRecentJobs } from "@/lib/recent-jobs";

// ISR como las categorías: el jobs.json cambia en cada recogida (6 h) y el HTML se refresca cada 10 min.
// Sin generateStaticParams: package-web-es.sh quita el prerender del build (necesita datos reales).
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildRecentMetadata(listRecentJobs(await getJobs()));
}

export default async function RecentJobsPage() {
  const allJobs = await getJobs();
  return <RecentJobsView set={listRecentJobs(allJobs)} allJobs={allJobs} />;
}
