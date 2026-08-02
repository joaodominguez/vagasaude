import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { SearchForm } from "@/components/search-form";
import { getJobs } from "@/lib/jobs-data";
import { professions } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vagas de saúde",
  description:
    "Pesquisa vagas de enfermagem, medicina, fisioterapia e outras profissões de saúde em Portugal.",
};

type SearchParams = Promise<{
  q?: string;
  distrito?: string;
  profissao?: string;
  setor?: string;
}>;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLocaleLowerCase("pt") ?? "";
  const district = params.distrito ?? "";
  const profession = params.profissao ?? "";
  const sector = params.setor ?? "";
  const jobs = await getJobs();

  const filteredJobs = jobs.filter((job) => {
    const haystack =
      `${job.title} ${job.company} ${job.profession}`.toLocaleLowerCase("pt");
    return (
      (!query || haystack.includes(query)) &&
      (!district || job.district === district) &&
      (!profession || job.profession === profession) &&
      (!sector || job.sector === sector)
    );
  });

  const hasFilters = Boolean(query || district || profession || sector);

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
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-24 content-card p-5">
              <div className="flex items-center gap-2 font-extrabold">
                <SlidersHorizontal size={18} />
                Filtros
              </div>

              <FilterGroup title="Profissão">
                {professions.map((item) => (
                  <FilterLink
                    key={item}
                    label={item}
                    name="profissao"
                    value={item}
                    active={profession === item}
                    params={params}
                    count={jobs.filter((job) => job.profession === item).length}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Setor">
                {["Público", "Privado", "IPSS"].map((item) => (
                  <FilterLink
                    key={item}
                    label={item}
                    name="setor"
                    value={item}
                    active={sector === item}
                    params={params}
                    count={jobs.filter((job) => job.sector === item).length}
                  />
                ))}
              </FilterGroup>

              {hasFilters && (
                <Link
                  href="/vagas"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  <X size={15} /> Limpar filtros
                </Link>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-[-0.03em]">
                  {filteredJobs.length}{" "}
                  {filteredJobs.length === 1 ? "vaga encontrada" : "vagas encontradas"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Ordenadas pelas mais recentes
                </p>
              </div>
              {hasFilters && (
                <Link
                  href="/vagas"
                  className="filter-chip lg:hidden"
                >
                  <X size={13} /> Limpar
                </Link>
              )}
            </div>

            {filteredJobs.length > 0 ? (
              <div className="min-w-0 space-y-3">
                {filteredJobs.map((job) => (
                  <JobCard key={job.slug} job={job} />
                ))}
              </div>
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
                    Limpar pesquisa
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

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
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
}: {
  label: string;
  name: string;
  value: string;
  active: boolean;
  params: Record<string, string | undefined>;
  count: number;
}) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => {
    if (item && key !== name) next.set(key, item);
  });
  if (!active) next.set(name, value);

  return (
    <Link
      href={`/vagas?${next.toString()}`}
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
