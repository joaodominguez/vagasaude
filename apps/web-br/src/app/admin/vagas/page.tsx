import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<StoredJob["status"], string> = {
  published: "Publicada",
  pending_review: "Em revisão",
  hidden: "Oculta",
  expired: "Expirada",
  duplicate: "Duplicada",
};

type SearchParams = Promise<{ estado?: string }>;

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter = params.estado?.trim() || "all";
  const jobs = await listAllStoredJobs();
  const filtered =
    statusFilter === "all"
      ? jobs
      : jobs.filter((job) => job.status === statusFilter);

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
                href={
                  filter.key === "all"
                    ? "/admin/vagas"
                    : `/admin/vagas?estado=${filter.key}`
                }
                className={`filter-chip ${active ? "filter-chip-active" : ""}`}
              >
                {filter.label} ({count})
              </Link>
            );
          })}
        </div>

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
                  <p className="truncate text-sm font-bold">{job.title}</p>
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
