import { getJobStats } from "@/lib/job-store";
import { latestRunBySource, listScraperRuns } from "@/lib/scraper-runs";
import { JOB_SOURCES, getSourceMeta } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SCHEDULE = "A cada 6 horas";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR");
}

export default async function AdminScrapersPage() {
  const [stats, latest, runs] = await Promise.all([
    getJobStats(),
    latestRunBySource(),
    listScraperRuns(40),
  ]);

  const registered = new Map(
    JOB_SOURCES.map((source) => [
      source.id,
      { slug: source.id, name: source.name, schedule: SCHEDULE },
    ]),
  );

  // Inclui fontes que já correram mas ainda não estão em JOB_SOURCES.
  for (const run of runs) {
    if (registered.has(run.source)) continue;
    const meta = getSourceMeta(run.source);
    registered.set(run.source, {
      slug: run.source,
      name: meta?.name || run.source,
      schedule: SCHEDULE,
    });
  }

  const scrapers = Array.from(registered.values());
  const showEmptyPlaceholder = scrapers.length === 0 && runs.length === 0;

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="section-kicker">Brasil · scrapers</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Fontes e corridas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Dados só em{" "}
            <code className="text-xs">/var/www/vagasaudebr/data</code>.{" "}
            Publicadas: {stats.published} · total: {stats.total}.
            {stats.updatedAt
              ? ` · Atualizado: ${formatWhen(stats.updatedAt)}`
              : ""}
          </p>
        </header>

        {showEmptyPlaceholder ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
            Ainda não há scrapers BR configurados. Copie o padrão de{" "}
            <code className="text-xs">scrapers/</code> (PT) para{" "}
            <code className="text-xs">scrapers-br/</code> e adapte as fontes ao
            mercado brasileiro.
          </div>
        ) : (
          <section className="content-card overflow-hidden">
            <div className="divide-y divide-border">
              {scrapers.map((scraper) => {
                const last = latest.get(scraper.slug);
                const failed = last?.status === "error";
                const publishedCount = stats.bySource[scraper.slug] || 0;
                return (
                  <article
                    key={scraper.slug}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <h2 className="text-sm font-extrabold">{scraper.name}</h2>
                      <p className="mt-1 text-xs text-muted">
                        Cron: {scraper.schedule} · Publicadas: {publishedCount}
                        {last
                          ? ` · Última: ${formatWhen(last.finishedAt) || "—"} (${last.found} encontradas)`
                          : " · Ainda sem corrida registada"}
                      </p>
                      {failed && last?.error ? (
                        <p className="mt-1 text-xs text-danger">{last.error}</p>
                      ) : null}
                    </div>
                    <span
                      className={`tag w-fit ${
                        !last
                          ? "tag-primary"
                          : failed
                            ? "tag-danger"
                            : "tag-primary"
                      }`}
                    >
                      {!last ? "Pendente" : failed ? "Erro" : "Ativo"}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-extrabold tracking-[-0.03em]">
            Corridas recentes
          </h2>
          <div className="content-card mt-4 overflow-hidden">
            <div className="divide-y divide-border">
              {runs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">
                  Sem corridas registadas.
                </p>
              ) : (
                runs.map((run) => (
                  <article
                    key={run.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {getSourceMeta(run.source)?.name || run.source}
                        <span className="ml-2 text-xs font-normal text-muted">
                          ({run.source})
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {run.found} encontradas
                        {run.created != null ? ` · ${run.created} novas` : ""}
                        {run.updated != null
                          ? ` · ${run.updated} atualizadas`
                          : ""}
                        {run.elapsed != null ? ` · ${run.elapsed}s` : ""}
                      </p>
                      {run.error ? (
                        <p className="mt-1 text-xs text-danger">{run.error}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted">
                      <p
                        className={
                          run.status === "ok"
                            ? "font-semibold text-success"
                            : "font-semibold text-danger"
                        }
                      >
                        {run.status === "ok" ? "OK" : "Erro"}
                      </p>
                      <p className="mt-1">
                        {formatWhen(run.finishedAt) || "—"}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
