import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<StoredJob["status"], string> = {
  published: "Publicada",
  pending_review: "Em revisão",
  hidden: "Oculta",
  expired: "Expirada",
  duplicate: "Duplicada",
};

type SearchParams = Promise<{ estado?: string; q?: string }>;

function searchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter = params.estado?.trim() || "all";
  const query = params.q?.trim() || "";
  const needle = searchKey(query);
  const jobs = await listAllStoredJobs();
  const byStatus =
    statusFilter === "all"
      ? jobs
      : jobs.filter((job) => job.status === statusFilter);
  // Pesquisa por título, empresa, local, slug, fonte ou ID na fonte.
  const filtered = needle
    ? byStatus.filter((job) =>
        searchKey(
          [
            job.title,
            job.company,
            job.locationDistrict,
            job.locationConcelho ?? "",
            job.slug,
            job.source,
            job.sourceId,
          ].join(" "),
        ).includes(needle),
      )
    : byStatus;
  const listHref = (estado: string) => {
    const search = new URLSearchParams();
    if (estado !== "all") search.set("estado", estado);
    if (query) search.set("q", query);
    const qs = search.toString();
    return qs ? `/admin/vagas?${qs}` : "/admin/vagas";
  };

  const counts = jobs.reduce<Record<string, number>>(
    (acc, job) => {
      acc.all += 1;
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    },
    { all: 0 },
  );

  const filters: Array<{ key: string; label: string }> = [
    { key: "all", label: "Todas" },
    { key: "published", label: "Publicadas" },
    { key: "pending_review", label: "Em revisão" },
    { key: "expired", label: "Expiradas" },
    { key: "duplicate", label: "Duplicadas" },
    { key: "hidden", label: "Ocultas" },
  ];

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Conteúdo</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Vagas
          </h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} de {jobs.length} registos
          </p>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = statusFilter === filter.key;
            const count = counts[filter.key] || 0;
            return (
              <Link
                key={filter.key}
                href={listHref(filter.key)}
                className={`filter-chip ${active ? "filter-chip-active" : ""}`}
              >
                {filter.label} ({count})
              </Link>
            );
          })}
        </div>

        <form action="/admin/vagas" className="mt-4 flex flex-wrap items-center gap-2">
          {statusFilter !== "all" && (
            <input type="hidden" name="estado" value={statusFilter} />
          )}
          <span className="input-shell min-w-0 flex-1">
            <Search aria-hidden="true" size={16} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Pesquisar por título, empresa, local, slug ou ID da fonte"
            />
          </span>
          <button type="submit" className="filter-chip">
            Pesquisar
          </button>
        </form>

        <section className="content-card mt-6 overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted">
                Sem vagas neste estado.
              </p>
            )}
            {filtered.slice(0, 100).map((job) => (
              <article
                key={job.id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/vagas/${encodeURIComponent(job.id)}`}
                    prefetch={false}
                    className="block truncate text-sm font-bold hover:text-primary"
                  >
                    {job.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {job.company} · {job.locationDistrict} · {job.source}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tag">{STATUS_LABEL[job.status]}</span>
                  {job.status === "published" && (
                    <Link
                      href={`/vagas/${job.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                      target="_blank"
                    >
                      Ver <ExternalLink size={12} />
                    </Link>
                  )}
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
                  >
                    Fonte <ExternalLink size={12} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          {filtered.length > 100 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted">
              A mostrar as 100 mais recentes deste filtro.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
