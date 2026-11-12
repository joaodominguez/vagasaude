import type { Metadata } from "next";
import { categoryEligibleCached, facetCounts, searchHaystack } from "@/lib/listing-cache";
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
  listCategoryChips,
} from "@/lib/categories";
import {
  CONTRACT_FILTERS,
  contractBucket,
  scoreJobRelevance,
} from "@/lib/contracts";
import { getJobs } from "@/lib/jobs-data";
import { districts, professions } from "@/lib/taxonomies";
import { inRegione } from "@/lib/it-locative";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const LISTING_METADATA: Metadata = {
  title: "Offerte di lavoro nella sanità in Italia: ricerca e filtri",
  description:
    "Cerca offerte di infermieristica, medicina, OSS, fisioterapia e altre professioni sanitarie in Italia. Filtra per regione, settore e contratto.",
  alternates: { canonical: "/offerte" },
  openGraph: {
    title: "Offerte di lavoro nella sanità in Italia: ricerca e filtri",
    description:
      "Cerca offerte di infermieristica, medicina, OSS, fisioterapia e altre professioni sanitarie in Italia. Filtra per regione, settore e contratto.",
    url: "/offerte",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Offerte di lavoro nella sanità in Italia: ricerca e filtri",
    description:
      "Cerca offerte di infermieristica, medicina, OSS, fisioterapia e altre professioni sanitarie in Italia. Filtra per regione, settore e contratto.",
  },
};

type SearchParams = Promise<{
  q?: string;
  regione?: string;
  professione?: string;
  settore?: string;
  contratto?: string;
  periodo?: string;
  ordina?: string;
  pagina?: string;
}>;

const FILTER_KEYS = [
  "q",
  "regione",
  "professione",
  "settore",
  "contratto",
  "periodo",
  "ordina",
] as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = FILTER_KEYS.some((key) => Boolean(params[key]?.trim()));
  const page = Number.parseInt(params.pagina || "1", 10) || 1;
  if (!filtered && page <= 1) return LISTING_METADATA;
  // Ricerche, filtri e pagine successive: navigabili ma fuori dall'indice:
  // le landing di categoria paginate coprono le stesse offerte.
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
    if (key === "pagina") return;
    if (value) next.set(key, value);
  });
  if (page && page > 1) next.set("pagina", String(page));
  const query = next.toString();
  return query ? `/offerte?${query}` : "/offerte";
}

/** Fuori dal componente: Date.now() è impuro e non va chiamato durante il render. */
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
  const query = queryRaw.toLocaleLowerCase("it");
  const district = params.regione ?? "";
  const profession = params.professione ?? "";
  const sector = params.settore ?? "";
  const contract = params.contratto ?? "";
  const period = params.periodo ?? "";
  const sort =
    params.ordina === "rilevanza" && queryRaw ? "rilevanza" : "recenti";
  const page = Math.max(1, Number.parseInt(params.pagina || "1", 10) || 1);
  const jobs = await getJobs();
  const topCategories = listCategoryChips(jobs, 10);

  const periodDays = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 0;
  const periodCutoff = periodDays ? periodCutoffIso(periodDays) : "";

  let filteredJobs = jobs.filter((job) => {
    const haystack = searchHaystack(job, "it");
    return (
      (!query || haystack.includes(query)) &&
      (!district || job.district === district) &&
      (!profession || job.profession === profession) &&
      (!sector || job.sector === sector) &&
      (!contract || contractBucket(job.contract) === contract) &&
      (!periodCutoff || job.publishedAt >= periodCutoff)
    );
  });

  if (sort === "rilevanza") {
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
    regione: district || undefined,
    professione: profession || undefined,
    settore: sector || undefined,
    contratto: contract || undefined,
    periodo: period || undefined,
    ordina: sort === "rilevanza" ? "rilevanza" : undefined,
  };

  const alertSummary = [
    profession,
    district ? inRegione(district) : "",
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
            <p className="section-kicker">Opportunità in Italia</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Trova l’offerta giusta per te
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
                    {category.title.replace(/^Offerte (di )?/i, "")}
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
                Filtri
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
                    ? "offerta trovata"
                    : "offerte trovate"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {sort === "rilevanza"
                    ? "Ordinate per rilevanza"
                    : "Ordinate dalle più recenti"}
                  {totalPages > 1
                    ? ` · pagina ${currentPage} di ${totalPages}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  rel="nofollow"
                  href={buildJobsHref({
                    ...filterParams,
                    ordina: undefined,
                  })}
                  className={
                    sort === "recenti"
                      ? "font-bold text-primary"
                      : "text-muted hover:text-primary"
                  }
                >
                  Più recenti
                </Link>
                <span className="text-border">·</span>
                <Link
                  rel="nofollow"
                  href={buildJobsHref({
                    ...filterParams,
                    ordina: queryRaw ? "rilevanza" : undefined,
                  })}
                  className={
                    sort === "rilevanza"
                      ? "font-bold text-primary"
                      : "text-muted hover:text-primary"
                  }
                  aria-disabled={!queryRaw}
                >
                  Rilevanza
                </Link>
              </div>
            </div>

            {hasFilters ? (
              <div className="content-card mb-5 p-5">
                <p className="text-sm font-extrabold">
                  Vuoi essere avvisato
                  {alertSummary ? ` — ${alertSummary}` : ""}?
                </p>
                <p className="mt-1 text-sm text-muted">
                  Crea un avviso con questi filtri e ricevi un’email quando compare
                  una nuova offerta.
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
                    aria-label="Paginazione"
                  >
                    {currentPage > 1 ? (
                      <Link
                        rel="nofollow"
                        href={buildJobsHref(filterParams, currentPage - 1)}
                        className="button button-secondary"
                      >
                        <ChevronLeft size={16} /> Precedente
                      </Link>
                    ) : (
                      <span />
                    )}
                    <p className="text-sm text-muted">
                      {start + 1}–
                      {Math.min(start + PAGE_SIZE, filteredJobs.length)} di{" "}
                      {filteredJobs.length}
                    </p>
                    {currentPage < totalPages ? (
                      <Link
                        rel="nofollow"
                        href={buildJobsHref(filterParams, currentPage + 1)}
                        className="button button-secondary"
                      >
                        Successiva <ChevronRight size={16} />
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
                  Non abbiamo ancora trovato questa offerta
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  Prova a rimuovere qualche filtro oppure crea un avviso per
                  ricevere nuove opportunità.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link className="button button-secondary" href="/offerte">
                    Rimuovi i filtri
                  </Link>
                  <Link className="button button-primary" href="/avvisi">
                    Crea avviso
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
  const facets = facetCounts(jobs);
  const districtItems = districts
    .map((item) => ({
      item,
      count: facets.district.get(item) ?? 0,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);

  const periodOptions = [
    ["24h", "Ultime 24 ore"],
    ["7d", "Ultimi 7 giorni"],
    ["30d", "Ultimi 30 giorni"],
  ] as const;

  return (
    <>
      <FilterGroup title="Professione">
        {professions
          .map((item) => ({
            item,
            count: facets.profession.get(item) ?? 0,
          }))
          .filter(({ count }) => count > 0)
          .map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="professione"
              value={item}
              active={profession === item}
              params={filterParams}
              count={count}
              preferCategory={
                !queryRaw && !sector && !district && !contract
                  ? categoryEligibleCached(jobs, item, null)
                    ? categoryPath(item, null)
                    : null
                  : !queryRaw && !sector && !contract && district
                    ? categoryEligibleCached(jobs, item, district)
                      ? categoryPath(item, district)
                      : null
                    : null
              }
            />
          ))}
      </FilterGroup>

      <FilterGroup title="Regione">
        <CollapsibleList limit={6}>
          {districtItems.map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="regione"
              value={item}
              active={district === item}
              params={filterParams}
              count={count}
            />
          ))}
        </CollapsibleList>
      </FilterGroup>

      <FilterGroup title="Settore">
        {["Pubblico", "Privato", "Accreditato"]
          .map((item) => ({
            item,
            count: facets.sector.get(item) ?? 0,
          }))
          .filter(({ count }) => count > 0)
          .map(({ item, count }) => (
            <FilterLink
              key={item}
              label={item}
              name="settore"
              value={item}
              active={sector === item}
              params={filterParams}
              count={count}
            />
          ))}
      </FilterGroup>

      <FilterGroup title="Contratto">
        {CONTRACT_FILTERS.map((item) => {
          const count = facets.contract.get(item) ?? 0;
          if (!count) return null;
          return (
            <FilterLink
              key={item}
              label={item}
              name="contratto"
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
          href="/offerte"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
        >
          <X size={15} /> Rimuovi i filtri
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
    if (!item || key === name || key === "pagina") return;
    next.set(key, item);
  });
  if (!active) next.set(name, value);

  const href =
    !active && preferCategory ? preferCategory : `/offerte?${next.toString()}`;

  return (
    <Link
      href={href}
      // Combinazioni di filtri: navigabili ma non seguite da Google (noindex).
      rel={href.startsWith("/offerte?") ? "nofollow" : undefined}
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
