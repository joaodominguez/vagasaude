import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CategoryPageView } from "@/components/category-page-view";
import {
  buildCategoryMetadata,
  categoryTotalPages,
  filterJobsForCategory,
  isCategoryEligible,
  listEligibleCategories,
  parseCategoryPageSegment,
  professionFromSlug,
  resolveCategoryFromSegments,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";

export const revalidate = 600;

type Params = Promise<{ slug: string; district: string }>;

/**
 * /vagas/[profissao]/[distrito] (combo, página 1) ou
 * /vagas/[profissao|distrito]/pagina-N (paginação das landings simples).
 */
function resolveSegments(slug: string, district: string) {
  const page = parseCategoryPageSegment(district);
  if (page) {
    const category = resolveCategoryFromSegments(slug);
    return category ? { category, page } : null;
  }
  // Só combinações profissão/distrito — evita capturar lixo sob /vagas/job/foo
  if (!professionFromSlug(slug)) return null;
  const category = resolveCategoryFromSegments(slug, district);
  return category ? { category, page: 1 } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, district } = await params;
  const resolved = resolveSegments(slug, district);
  if (!resolved) return { title: "Categoria não encontrada" };
  const { category, page } = resolved;
  const jobs = filterJobsForCategory(
    await getJobs(),
    category.profession,
    category.district,
  );
  if (jobs.length < 3) return { title: category.title };
  return buildCategoryMetadata(category, jobs.length, jobs, page);
}

export default async function ProfessionDistrictPage({
  params,
}: {
  params: Params;
}) {
  const { slug, district } = await params;
  const resolved = resolveSegments(slug, district);
  if (!resolved) notFound();
  const { category, page } = resolved;

  const allJobs = await getJobs();
  if (!isCategoryEligible(allJobs, category.profession, category.district)) {
    const qs = new URLSearchParams();
    if (category.profession) qs.set("profissao", category.profession);
    if (category.district) qs.set("distrito", category.district);
    redirect(`/vagas?${qs.toString()}`);
  }

  const jobs = filterJobsForCategory(
    allJobs,
    category.profession,
    category.district,
  );
  if (page > categoryTotalPages(jobs.length)) notFound();

  return (
    <CategoryPageView
      category={category}
      jobs={jobs}
      page={page}
      allCategoryRefs={listEligibleCategories(allJobs)}
    />
  );
}
