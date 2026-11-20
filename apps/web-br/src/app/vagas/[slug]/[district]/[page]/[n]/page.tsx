import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LocalLandingView } from "@/components/local-landing-view";
import {
  categoryTotalPages,
  isFirstPageSegment,
  parseCategoryPageSegment,
} from "@/lib/categories";
import { getListingJobs } from "@/lib/jobs-data";
import { buildLocalMetadata, resolveLocal } from "@/lib/local-landings";

export const dynamic = "force-static";
export const revalidate = 600;

/** /vagas/[estado]/[cidade]/[profissao]/pagina-N (paginação da landing profissão × cidade) */
type Params = Promise<{ slug: string; district: string; page: string; n: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, district, page: professionSlug, n } = await params;
  const pageNumber = parseCategoryPageSegment(n);
  const local = pageNumber
    ? resolveLocal(await getListingJobs(), slug, district, professionSlug)
    : null;
  if (!local || !pageNumber) return { title: "Página não encontrada" };
  return buildLocalMetadata(local, pageNumber);
}

export default async function LocalLandingPagedPage({ params }: { params: Params }) {
  const { slug, district, page: professionSlug, n } = await params;
  const jobs = await getListingJobs();
  const local = resolveLocal(jobs, slug, district, professionSlug);
  if (!local) notFound();
  if (isFirstPageSegment(n)) permanentRedirect(local.path);
  const pageNumber = parseCategoryPageSegment(n);
  if (!pageNumber || pageNumber > categoryTotalPages(local.jobs.length)) notFound();
  return <LocalLandingView local={local} page={pageNumber} allJobs={jobs} />;
}
