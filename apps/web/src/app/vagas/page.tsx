import type { Metadata } from "next";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "Vagas de saúde",
  description:
    "Pesquisa vagas de enfermagem, medicina, fisioterapia e outras profissões de saúde em Portugal.",
  alternates: { canonical: "/vagas" },
  openGraph: {
    title: "Vagas de saúde | VagaSaúde",
    description:
      "Pesquisa vagas de enfermagem, medicina, fisioterapia e outras profissões de saúde em Portugal.",
    url: "/vagas",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vagas de saúde | VagaSaúde",
    description:
      "Pesquisa vagas de enfermagem, medicina, fisioterapia e outras profissões de saúde em Portugal.",
  },
};

type SearchParams = Promise<{
  q?: string;
  distrito?: string;
  profissao?: string;
  setor?: string;
  contrato?: string;
  periodo?: string;
  ordenar?: string;
  page?: string;
}>;

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
  return query ? `/vagas?${query}` : "/vagas";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const queryRaw = params.q?.trim() ?? "";
  const query = queryRaw.toLocaleLowerCase("pt");
  const district = params.distrito ?? "";
  const profession = params.profissao ?? "";
  const sector = params.setor ?? "";
  const contract = params.contrato ?? "";
  const period = params.periodo ?? "";
  const sort =
    params.ordenar === "relevancia" && queryRaw ? "relevancia" : "recentes";
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const jobs = await getJobs();
  const topCategories = listCategoryChips(jobs, 10);

  const periodDays = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 0;
  const periodCutoff = periodDays
    ? new Date(Date.now() - periodDays * 86_400_000).toISOString()
    : "";

  let filteredJobs = jobs.filter((job) => {
    const haystack =
      `${job.title} ${job.company} ${job.profession} ${job.description}`.toLocaleLowerCase("pt");
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
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(start, start + PAGE_SIZE);

  const hasFilters = Boolean(
    queryRaw || district || profession || sector || contract || period,
  );
  const filterParams = {
    q: params.q,
    distrito: district || undefined,
    profissao: profession || undefined,
    setor: sector || undefined,
    contrato: contract || undefined,
    periodo: period || undefined,
    ordenar: sort === "relevancia" ? "relevancia" : undefined,
  };

  const alertSummary = [
    profession,
    district ? `em ${district}` : "",
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
            <p className="section-kicker">Oportunidades em Portugal</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Encontra a vaga certa para ti
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
                  <Link
                    key={category.path}
                    href={category.path}
                    className="filter-chip"
                  >
                    {category.title.replace(/^Vagas (de )?/i, "")}
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
                    ? "vaga encontrada"
                    : "vagas encontradas"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {sort === "relevancia"
                    ? "Ordenadas por relevância"
                    : "Ordenadas pelas mais recentes"}
                  {totalPages > 1
                    ? ` · página ${currentPage} de ${totalPages}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
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
                  Mais recentes
                </Link>
                <span className="text-border">·</span>
                <Link
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
                  Relevância
                </Link>
              </div>
            </div>

            {hasFilters ? (
              <div className="content-card mb-5 p-5">
                <p className="text-sm font-extrabold">
                  Queres ser avisado
                  {alertSummary ? ` — ${alertSummary}` : ""}?
                </p>
                <p className="mt-1 text-sm text-muted">
                  Cria um alerta com estes filtros e recebe email quando surgir
                  uma vaga nova.
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
                    aria-label="Paginação"
                  >
                    {currentPage > 1 ? (
                      <Link
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
                        href={buildJobsHref(filterParams, currentPage + 1)}
                        className="button button-secondary"
                      >
                        Seguinte <ChevronRight size={16} />
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
                  Ainda não encontrámos essa vaga
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  Experimenta remover alguns filtros ou cria um alerta para
                  receber novas oportunidades.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link className="button button-secondary" href="/vagas">
                    Limpar filtros
                  </Link>
                  <Link className="button button-primary" href="/alertas">
                    Criar alerta
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
    ["7d", "Últimos 7 dias"],
    ["30d", "Últimos 30 dias"],
  ] as const;

  return (
    <>
      <FilterGroup title="Profissão">
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
              name="profissao"
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

      <FilterGroup title="Distrito">
        <CollapsibleList limit={6}>
          {districtItems.map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="distrito"
              value={item}
              active={district === item}
              params={filterParams}
              count={count}
            />
          ))}
        </CollapsibleList>
      </FilterGroup>

      <FilterGroup title="Setor">
        {["Público", "Privado", "IPSS"]
          .map((item) => ({
            item,
            count: jobs.filter((job) => job.sector === item).length,
          }))
          .filter(({ count }) => count > 0)
          .map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="setor"
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

      <FilterGroup title="Período">
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
          href="/vagas"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
        >
          <X size={15} /> Limpar filtros
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
    !active && preferCategory ? preferCategory : `/vagas?${next.toString()}`;

  return (
    <Link
      href={href}
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
