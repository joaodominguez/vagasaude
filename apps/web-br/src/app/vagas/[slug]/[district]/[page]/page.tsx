import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { CategoryPageView } from "@/components/category-page-view";
import { CityPageView } from "@/components/city-page-view";
import { LocalLandingView } from "@/components/local-landing-view";
import { buildCityMetadata, resolveCity } from "@/lib/cities";
import {
  buildCategoryMetadata,
  categoryTotalPages,
  filterJobsForCategory,
  isCategoryEligible,
  isFirstPageSegment,
  listEligibleCategories,
  parseCategoryPageSegment,
  resolveCategoryFromSegments,
  fallbackCategoryPath,
} from "@/lib/categories";
import { getListingJobs } from "@/lib/jobs-data";
import { buildLocalMetadata, resolveLocal } from "@/lib/local-landings";

export const dynamic = "force-static";
export const revalidate = 600;

/** /vagas/[profissao]/[estado]/pagina-N */
type Params = Promise<{ slug: string; district: string; page: string }>;

function resolveSegments(slug: string, district: string, pageSegment: string) {
  const page = parseCategoryPageSegment(pageSegment);
  if (!page) return null;
  const category = resolveCategoryFromSegments(slug, district);
  return category ? { category, page } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, district, page: pageSegment } = await params;
  const cityPage = parseCategoryPageSegment(pageSegment);
  const city = cityPage ? resolveCity(await getListingJobs(), slug, district) : null;
  if (city && cityPage) return buildCityMetadata(city, cityPage);
  // /vagas/<estado>/<cidade>/<profissao>: landing profissão × cidade.
  const local = !cityPage ? resolveLocal(await getListingJobs(), slug, district, pageSegment) : null;
  if (local) return buildLocalMetadata(local);
  const resolved = resolveSegments(slug, district, pageSegment);
  if (!resolved) return { title: "Categoria não encontrada" };
  const { category, page } = resolved;
  const jobs = filterJobsForCategory(
    await getListingJobs(),
    category.profession,
    category.district,
  );
  if (jobs.length < 3) return { title: category.title };
  return buildCategoryMetadata(category, jobs.length, page);
}

export default async function ProfessionDistrictPagedPage({
  params,
}: {
  params: Params;
}) {
  const { slug, district, page: pageSegment } = await params;
  const cityJobs = await getListingJobs();
  const city = resolveCity(cityJobs, slug, district);
  if (city) {
    if (isFirstPageSegment(pageSegment)) permanentRedirect(city.path);
    const cityPage = parseCategoryPageSegment(pageSegment);
    if (cityPage) {
      if (cityPage > categoryTotalPages(city.jobs.length)) notFound();
      return <CityPageView city={city} page={cityPage} allJobs={cityJobs} />;
    }
    // Primeira página da landing profissão × cidade (as seguintes: [page]/[n]).
    // Abaixo do mínimo o proxy já redireciona para a cidade; aqui, 404 de segurança.
    const local = resolveLocal(cityJobs, slug, district, pageSegment);
    if (local) return <LocalLandingView local={local} allJobs={cityJobs} />;
    notFound();
  }
  if (isFirstPageSegment(pageSegment)) {
    const first = resolveCategoryFromSegments(slug, district);
    if (first) permanentRedirect(first.path);
  }
  const resolved = resolveSegments(slug, district, pageSegment);
  if (!resolved) notFound();
  const { category, page } = resolved;

  const allJobs = await getListingJobs();
  if (!isCategoryEligible(allJobs, category.profession, category.district)) {
    redirect(fallbackCategoryPath(allJobs, category.profession, category.district));
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
