import type { Metadata } from "next";
import { RecentJobsView } from "@/components/recent-jobs-view";
import { getListingJobs } from "@/lib/jobs-data";
import { buildRecentMetadata, listRecentJobs } from "@/lib/recent-jobs";

// ISR como as categorias: o jobs.json muda a cada recolha (6 h) e o HTML refresca de 10 em 10 min.
// Sem generateStaticParams: o package-web-br.sh remove o prerender do build (precisa de dados reais).
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildRecentMetadata(listRecentJobs(await getListingJobs()));
}

export default async function RecentJobsPage() {
  const allJobs = await getListingJobs();
  return <RecentJobsView set={listRecentJobs(allJobs)} allJobs={allJobs} />;
}
