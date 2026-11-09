import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConcelhoPageView } from "@/components/concelho-page-view";
import {
  buildConcelhoMetadata,
  filterJobsForConcelho,
  listEligibleConcelhos,
  resolveConcelhoSegments,
} from "@/lib/concelhos";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

/** /vagas/concelho/[distrito]/[concelho] — só existe com ≥ CATEGORY_MIN_JOBS vagas. */
type Params = Promise<{ district: string; concelho: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { district, concelho } = await params;
  const ref = resolveConcelhoSegments(district, concelho);
  if (!ref) return { title: "Concelho não encontrado", robots: { index: false } };
  const jobs = filterJobsForConcelho(await getJobs(), ref.district, ref.concelho);
  return buildConcelhoMetadata(ref, jobs.length);
}

export default async function ConcelhoPage({ params }: { params: Params }) {
  const { district, concelho } = await params;
  const ref = resolveConcelhoSegments(district, concelho);
  if (!ref) notFound();
  const allJobs = await getJobs();
  const eligible = listEligibleConcelhos(allJobs);
  if (!eligible.some((item) => item.path === ref.path)) {
    // Concelho sem vagas suficientes → landing do distrito (indexável), nunca /vagas?… (robots).
    redirect(isCategoryEligible(allJobs, null, ref.district) ? categoryPath(null, ref.district) : "/vagas");
  }
  const jobs = filterJobsForConcelho(allJobs, ref.district, ref.concelho);
  const siblings = eligible
    .filter((item) => item.district === ref.district && item.path !== ref.path)
    .slice(0, 12);
  return (
    <ConcelhoPageView concelho={ref} jobs={jobs} allJobs={allJobs} siblings={siblings} />
  );
}
