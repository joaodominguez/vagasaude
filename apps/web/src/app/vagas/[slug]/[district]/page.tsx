import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CategoryPageView } from "@/components/category-page-view";
import {
  buildCategoryMetadata,
  filterJobsForCategory,
  isCategoryEligible,
  listEligibleCategories,
  professionFromSlug,
  resolveCategoryFromSegments,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; district: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, district } = await params;
  if (!professionFromSlug(slug)) {
    return { title: "Categoria não encontrada" };
  }
  const category = resolveCategoryFromSegments(slug, district);
  if (!category) return { title: "Categoria não encontrada" };
  const jobs = filterJobsForCategory(
    await getJobs(),
    category.profession,
    category.district,
  );
  if (jobs.length < 3) return { title: category.title };
  return buildCategoryMetadata(category, jobs.length);
}

export default async function ProfessionDistrictPage({
  params,
}: {
  params: Params;
}) {
  const { slug, district } = await params;
  // Só combinações profissão/distrito — evita capturar lixo sob /vagas/job/foo
  if (!professionFromSlug(slug)) notFound();

  const category = resolveCategoryFromSegments(slug, district);
  if (!category) notFound();

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

  return (
    <CategoryPageView
      category={category}
      jobs={jobs}
      allCategoryRefs={listEligibleCategories(allJobs)}
    />
  );
}
