import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { RecentJobsView } from "@/components/recent-jobs-view";
import { isFirstPageSegment, parseCategoryPageSegment } from "@/lib/categories";
import { getListingJobs } from "@/lib/jobs-data";
import {
  RECENT_PATH,
  buildRecentMetadata,
  listRecentJobs,
  recentTotalPages,
} from "@/lib/recent-jobs";

export const dynamic = "force-static";
export const revalidate = 600;

/** /vagas/hoje/pagina-N */
type Params = Promise<{ page: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = parseCategoryPageSegment((await params).page);
  if (!page) return { title: "Página não encontrada" };
  return buildRecentMetadata(listRecentJobs(await getListingJobs()), page);
}

export default async function RecentJobsPagedPage({ params }: { params: Params }) {
  const segment = (await params).page;
  if (isFirstPageSegment(segment)) permanentRedirect(RECENT_PATH);
  const page = parseCategoryPageSegment(segment);
  if (!page) notFound();
  const allJobs = await getListingJobs();
  const set = listRecentJobs(allJobs);
  if (page > recentTotalPages(set.jobs.length)) notFound();
  return <RecentJobsView set={set} page={page} allJobs={allJobs} />;
}
