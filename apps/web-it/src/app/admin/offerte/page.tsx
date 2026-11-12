import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<StoredJob["status"], string> = {
  published: "Pubblicata",
  pending_review: "In revisione",
  hidden: "Nascosta",
  expired: "Scaduta",
  duplicate: "Duplicata",
};

type SearchParams = Promise<{ stato?: string; q?: string }>;

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
  const statusFilter = params.stato?.trim() || "all";
  const query = params.q?.trim() || "";
  const needle = searchKey(query);
  const jobs = await listAllStoredJobs();
  const byStatus =
    statusFilter === "all"
      ? jobs
      : jobs.filter((job) => job.status === statusFilter);
  // Ricerca per titolo, azienda, luogo, slug, fonte o ID nella fonte.
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
  const listHref = (stato: string) => {
    const search = new URLSearchParams();
    if (stato !== "all") search.set("stato", stato);
    if (query) search.set("q", query);
    const qs = search.toString();
    return qs ? `/admin/offerte?${qs}` : "/admin/offerte";
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
    { key: "all", label: "Tutte" },
    { key: "published", label: "Pubblicate" },
    { key: "pending_review", label: "In revisione" },
    { key: "expired", label: "Scadute" },
    { key: "duplicate", label: "Duplicate" },
    { key: "hidden", label: "Nascoste" },
  ];

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Contenuti</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Offerte
          </h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} de {jobs.length} record
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

        <form action="/admin/offerte" className="mt-4 flex flex-wrap items-center gap-2">
          {statusFilter !== "all" && (
            <input type="hidden" name="stato" value={statusFilter} />
          )}
          <span className="input-shell min-w-0 flex-1">
            <Search aria-hidden="true" size={16} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cerca per titolo, ente, luogo, slug o ID della fonte"
            />
          </span>
          <button type="submit" className="filter-chip">
            Cerca
          </button>
        </form>

        <section className="content-card mt-6 overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted">
                Nessuna offerta in questo stato.
              </p>
            )}
            {filtered.slice(0, 100).map((job) => (
              <article
                key={job.id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/offerte/${encodeURIComponent(job.id)}`}
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
                      href={`/offerte/${job.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                      target="_blank"
                    >
                      Vedi <ExternalLink size={12} />
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
              Mostrate le 100 più recenti di questo filtro.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
