import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { ConcelhoPageView } from "@/components/concelho-page-view";
import {
  categoryTotalPages,
  isFirstPageSegment,
  parseCategoryPageSegment,
} from "@/lib/categories";
import {
  buildConcelhoMetadata,
  filterJobsForConcelho,
  listEligibleConcelhos,
  resolveConcelhoSegments,
} from "@/lib/concelhos";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

/** /vagas/concelho/[distrito]/[concelho]/pagina-N */
type Params = Promise<{ district: string; concelho: string; page: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { district, concelho, page: pageSegment } = await params;
  const ref = resolveConcelhoSegments(district, concelho);
  const page = parseCategoryPageSegment(pageSegment);
  if (!ref || !page) return { title: "Concelho não encontrado", robots: { index: false } };
  const jobs = filterJobsForConcelho(await getJobs(), ref.district, ref.concelho);
  return buildConcelhoMetadata(ref, jobs.length, page);
}

export default async function ConcelhoPagedPage({ params }: { params: Params }) {
  const { district, concelho, page: pageSegment } = await params;
  const ref = resolveConcelhoSegments(district, concelho);
  if (!ref) notFound();
  if (isFirstPageSegment(pageSegment)) permanentRedirect(ref.path);
  const page = parseCategoryPageSegment(pageSegment);
  if (!page) notFound();

  const allJobs = await getJobs();
  const eligible = listEligibleConcelhos(allJobs);
  if (!eligible.some((item) => item.path === ref.path)) {
    redirect(`/vagas?distrito=${encodeURIComponent(ref.district)}`);
  }
  const jobs = filterJobsForConcelho(allJobs, ref.district, ref.concelho);
  if (page > categoryTotalPages(jobs.length)) notFound();
  const siblings = eligible
    .filter((item) => item.district === ref.district && item.path !== ref.path)
    .slice(0, 12);
  return (
    <ConcelhoPageView
      concelho={ref}
      jobs={jobs}
      allJobs={allJobs}
      siblings={siblings}
      page={page}
    />
  );
}
