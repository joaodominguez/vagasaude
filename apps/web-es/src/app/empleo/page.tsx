import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { CollapsibleList } from "@/components/collapsible-list";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { MobileFilterSheet } from "@/components/mobile-filter-sheet";
import { SearchForm } from "@/components/search-form";
import {
  categoryPath,
  isCategoryEligible,
  listCategoryChips,
} from "@/lib/categories";
import {
  CONTRACT_FILTERS,
  contractBucket,
  scoreJobRelevance,
} from "@/lib/contracts";
import { getJobs } from "@/lib/jobs-data";
import { districts, professions } from "@/lib/taxonomies";
import { enLugar } from "@/lib/es-locative";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const LISTING_METADATA: Metadata = {
  title: "Ofertas de empleo sanitario en España: búsqueda y filtros",
  description:
    "Busca ofertas de enfermería, medicina, TCAE, fisioterapia y otras profesiones sanitarias en España. Filtra por comunidad autónoma, sector y contrato.",
  alternates: { canonical: "/empleo" },
  openGraph: {
    title: "Ofertas de empleo sanitario en España: búsqueda y filtros",
    description:
      "Busca ofertas de enfermería, medicina, TCAE, fisioterapia y otras profesiones sanitarias en España. Filtra por comunidad autónoma, sector y contrato.",
    url: "/empleo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ofertas de empleo sanitario en España: búsqueda y filtros",
    description:
      "Busca ofertas de enfermería, medicina, TCAE, fisioterapia y otras profesiones sanitarias en España. Filtra por comunidad autónoma, sector y contrato.",
  },
};

type SearchParams = Promise<{
  q?: string;
  comunidad?: string;
  profesion?: string;
  sector?: string;
  contrato?: string;
  periodo?: string;
  ordenar?: string;
  page?: string;
}>;

const FILTER_KEYS = [
  "q",
  "comunidad",
  "profesion",
  "sector",
  "contrato",
  "periodo",
  "ordenar",
] as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = FILTER_KEYS.some((key) => Boolean(params[key]?.trim()));
  const page = Number.parseInt(params.page || "1", 10) || 1;
  if (!filtered && page <= 1) return LISTING_METADATA;
  // Búsqueda, filtros y páginas siguientes: navegables pero fuera del índice:
  // las landings de categoría paginadas cubren las mismas ofertas.
  return {
    ...LISTING_METADATA,
    alternates: { canonical: null },
    robots: { index: false, follow: true },
  };
}

function buildJobsHref(
  params: Record<string, string | undefined>,
  page?: number,
) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key === "page") return;
    if (value) next.set(key, value);
  });
  if (page && page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `/empleo?${query}` : "/empleo";
}

/** Fuera del componente: Date.now() es impuro y no debe llamarse durante el render. */
function periodCutoffIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const queryRaw = params.q?.trim() ?? "";
  const query = queryRaw.toLocaleLowerCase("es");
  const district = params.comunidad ?? "";
  const profession = params.profesion ?? "";
  const sector = params.sector ?? "";
  const contract = params.contrato ?? "";
  const period = params.periodo ?? "";
  const sort =
    params.ordenar === "relevancia" && queryRaw ? "relevancia" : "recentes";
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const jobs = await getJobs();
  const topCategories = listCategoryChips(jobs, 10);

  const periodDays = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 0;
  const periodCutoff = periodDays ? periodCutoffIso(periodDays) : "";

  let filteredJobs = jobs.filter((job) => {
    const haystack =
      `${job.title} ${job.company} ${job.profession} ${job.description}`.toLocaleLowerCase("es");
    return (
      (!query || haystack.includes(query)) &&
      (!district || job.district === district) &&
      (!profession || job.profession === profession) &&
      (!sector || job.sector === sector) &&
      (!contract || contractBucket(job.contract) === contract) &&
      (!periodCutoff || job.publishedAt >= periodCutoff)
    );
  });

  if (sort === "relevancia") {
    filteredJobs = [...filteredJobs].sort((a, b) => {
      const score =
        scoreJobRelevance(b, queryRaw) - scoreJobRelevance(a, queryRaw);
      if (score !== 0) return score;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  if (page > totalPages) notFound();
  const currentPage = page;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(start, start + PAGE_SIZE);

  const hasFilters = Boolean(
    queryRaw || district || profession || sector || contract || period,
  );
  const filterParams = {
    q: params.q,
    comunidad: district || undefined,
    profesion: profession || undefined,
    sector: sector || undefined,
    contrato: contract || undefined,
    periodo: period || undefined,
    ordenar: sort === "relevancia" ? "relevancia" : undefined,
  };

  const alertSummary = [
    profession,
    district ? enLugar(district) : "",
    sector,
    contract,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <p className="section-kicker">Oportunidades en España</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Encuentra la oferta adecuada para ti
            </h1>
            <div className="mt-6">
              <SearchForm
                compact
                defaultQuery={params.q}
                defaultDistrict={district}
              />
            </div>
            {topCategories.length > 0 && !hasFilters && (
              <div className="mt-5 flex flex-wrap gap-2">
                {topCategories.map((category) => (
                  <Link prefetch={false}
                    key={category.path}
                    href={category.path}
                    className="filter-chip"
                  >
                    {category.title.replace(/^Ofertas (de )?/i, "")}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden min-w-0 lg:block">
            <div className="content-card p-5 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 font-extrabold">
                <SlidersHorizontal size={18} />
                Filtros
              </div>

              <SidebarFilters
                jobs={jobs}
                profession={profession}
                district={district}
                sector={sector}
                contract={contract}
                period={period}
                filterParams={filterParams}
                hasFilters={hasFilters}
                queryRaw={queryRaw}
              />
            </div>
          </aside>

          <section className="min-w-0">
            <MobileFilterSheet
              activeCount={
                [profession, district, sector, contract, period].filter(Boolean)
                  .length
              }
            >
              <SidebarFilters
                jobs={jobs}
                profession={profession}
                district={district}
                sector={sector}
                contract={contract}
                period={period}
                filterParams={filterParams}
                hasFilters={hasFilters}
                queryRaw={queryRaw}
              />
            </MobileFilterSheet>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-[-0.03em]">
                  {filteredJobs.length}{" "}
                  {filteredJobs.length === 1
                    ? "oferta encontrada"
                    : "ofertas encontradas"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {sort === "relevancia"
                    ? "Ordenadas por relevancia"
                    : "Ordenadas por más recientes"}
                  {totalPages > 1
                    ? ` · página ${currentPage} de ${totalPages}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  rel="nofollow"
                  href={buildJobsHref({
                    ...filterParams,
                    ordenar: undefined,
                  })}
                  className={
                    sort === "recentes"
                      ? "font-bold text-primary"
                      : "text-muted hover:text-primary"
                  }
                >
                  Más recientes
                </Link>
                <span className="text-border">·</span>
                <Link
                  rel="nofollow"
                  href={buildJobsHref({
                    ...filterParams,
                    ordenar: queryRaw ? "relevancia" : undefined,
                  })}
                  className={
                    sort === "relevancia"
                      ? "font-bold text-primary"
                      : "text-muted hover:text-primary"
                  }
                  aria-disabled={!queryRaw}
                >
                  Relevancia
                </Link>
              </div>
            </div>

            {hasFilters ? (
              <div className="content-card mb-5 p-5">
                <p className="text-sm font-extrabold">
                  ¿Quieres que te avisemos
                  {alertSummary ? ` — ${alertSummary}` : ""}?
                </p>
                <p className="mt-1 text-sm text-muted">
                  Crea una alerta con estos filtros y recibe un email cuando aparezca
                  una oferta nueva.
                </p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={district}
                    defaultProfession={profession}
                    defaultSector={sector}
                  />
                </div>
              </div>
            ) : null}

            {pageJobs.length > 0 ? (
              <>
                <div className="min-w-0 space-y-3">
                  {pageJobs.map((job) => (
                    <JobCard key={job.slug} job={job} />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <nav
                    className="mt-8 flex flex-wrap items-center justify-between gap-3"
                    aria-label="Paginación"
                  >
                    {currentPage > 1 ? (
                      <Link
                        rel="nofollow"
                        href={buildJobsHref(filterParams, currentPage - 1)}
                        className="button button-secondary"
                      >
                        <ChevronLeft size={16} /> Anterior
                      </Link>
                    ) : (
                      <span />
                    )}
                    <p className="text-sm text-muted">
                      {start + 1}–
                      {Math.min(start + PAGE_SIZE, filteredJobs.length)} de{" "}
                      {filteredJobs.length}
                    </p>
                    {currentPage < totalPages ? (
                      <Link
                        rel="nofollow"
                        href={buildJobsHref(filterParams, currentPage + 1)}
                        className="button button-secondary"
                      >
                        Siguiente <ChevronRight size={16} />
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="content-card px-6 py-14 text-center">
                <h2 className="text-xl font-extrabold">
                  Todavía no hemos encontrado esa oferta
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  Prueba a quitar algún filtro o crea una alerta para
                  recibir nuevas oportunidades.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link className="button button-secondary" href="/empleo">
                    Quitar filtros
                  </Link>
                  <Link className="button button-primary" href="/alertas">
                    Crear alerta
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SidebarFilters({
  jobs,
  profession,
  district,
  sector,
  contract,
  period,
  filterParams,
  hasFilters,
  queryRaw,
}: {
  jobs: import("@/lib/jobs").Job[];
  profession: string;
  district: string;
  sector: string;
  contract: string;
  period: string;
  filterParams: Record<string, string | undefined>;
  hasFilters: boolean;
  queryRaw: string;
}) {
  const districtItems = districts
    .map((item) => ({
      item,
      count: jobs.filter((job) => job.district === item).length,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);

  const periodOptions = [
    ["24h", "Últimas 24 horas"],
    ["7d", "Últimos 7 días"],
    ["30d", "Últimos 30 días"],
  ] as const;

  return (
    <>
      <FilterGroup title="Profesión">
        {professions
          .map((item) => ({
            item,
            count: jobs.filter((job) => job.profession === item).length,
          }))
          .filter(({ count }) => count > 0)
          .map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="profesion"
              value={item}
              active={profession === item}
              params={filterParams}
              count={count}
              preferCategory={
                !queryRaw && !sector && !district && !contract
                  ? isCategoryEligible(jobs, item, null)
                    ? categoryPath(item, null)
                    : null
                  : !queryRaw && !sector && !contract && district
                    ? isCategoryEligible(jobs, item, district)
                      ? categoryPath(item, district)
                      : null
                    : null
              }
            />
          ))}
      </FilterGroup>

      <FilterGroup title="Comunidad autónoma">
        <CollapsibleList limit={6}>
          {districtItems.map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="comunidad"
              value={item}
              active={district === item}
              params={filterParams}
              count={count}
            />
          ))}
        </CollapsibleList>
      </FilterGroup>

      <FilterGroup title="Sector">
        {["Público", "Privado", "Concertado"]
          .map((item) => ({
            item,
            count: jobs.filter((job) => job.sector === item).length,
          }))
          .filter(({ count }) => count > 0)
          .map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="sector"
              value={item}
              active={sector === item}
              params={filterParams}
              count={count}
            />
          ))}
      </FilterGroup>

      <FilterGroup title="Contrato">
        {CONTRACT_FILTERS.map((item) => {
          const count = jobs.filter(
            (job) => contractBucket(job.contract) === item,
          ).length;
          if (!count) return null;
          return (
            <FilterLink
              key={item}
              label={item}
              name="contrato"
              value={item}
              active={contract === item}
              params={filterParams}
              count={count}
            />
          );
        })}
      </FilterGroup>

      <FilterGroup title="Periodo">
        {periodOptions.map(([value, label]) => (
          <FilterLink
            key={value}
            label={label}
            name="periodo"
            value={value}
            active={period === value}
            params={filterParams}
            count={
              jobs.filter(
                (job) =>
                  job.publishedAt >=
                  new Date(
                    Date.now() -
                      (value === "24h" ? 1 : value === "7d" ? 7 : 30) *
                        86_400_000,
                  ).toISOString(),
              ).length
            }
          />
        ))}
      </FilterGroup>

      {hasFilters && (
        <Link
          href="/empleo"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
        >
          <X size={15} /> Quitar filtros
        </Link>
      )}
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  );
}

function FilterLink({
  label,
  name,
  value,
  active,
  params,
  count,
  preferCategory,
}: {
  label: string;
  name: string;
  value: string;
  active: boolean;
  params: Record<string, string | undefined>;
  count: number;
  preferCategory?: string | null;
}) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => {
    if (!item || key === name || key === "page") return;
    next.set(key, item);
  });
  if (!active) next.set(name, value);

  const href =
    !active && preferCategory ? preferCategory : `/empleo?${next.toString()}`;

  return (
    <Link
      href={href}
      // Combinaciones de filtros: navegables pero no seguidas por Google (noindex).
      rel={href.startsWith("/empleo?") ? "nofollow" : undefined}
      className={`flex min-h-9 items-center justify-between rounded-lg px-2.5 text-sm transition ${
        active
          ? "bg-primary-soft font-bold text-primary"
          : "text-muted hover:bg-primary-soft hover:text-primary"
      }`}
    >
      {label}
      <span className="text-xs">{count}</span>
    </Link>
  );
}
