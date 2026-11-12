import { getJobStats } from "@/lib/job-store";
import { SOURCE_META } from "@/lib/sources";
import { latestRunBySource, listScraperRuns } from "@/lib/scraper-runs";

export const dynamic = "force-dynamic";

/** Catalogo derivato dalle fonti attive (src/lib/sources.ts). */
const SCRAPERS = Object.entries(SOURCE_META).map(([slug, meta]) => ({
  slug,
  name: meta.name,
  schedule: "Ogni 6 ore",
}));

export default async function AdminScrapersPage() {
  const [stats, latest, runs] = await Promise.all([
    getJobStats(),
    latestRunBySource(),
    listScraperRuns(30),
  ]);

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Automazione</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Scrapers
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ultimo aggiornamento dei dati:{" "}
            {stats.updatedAt
              ? new Date(stats.updatedAt).toLocaleString("it-IT")
              : "—"}
          </p>
        </header>

        <section className="content-card mt-8 overflow-hidden">
          <div className="divide-y divide-border">
            {SCRAPERS.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">
                Non ci sono ancora scraper per l’Italia (le fonti verranno scelte dopo la ricerca, vedi docs/it/).
              </p>
            ) : null}
            {SCRAPERS.map((scraper) => {
              const last = latest.get(scraper.slug);
              const failed = last?.status === "error";
              return (
                <article
                  key={scraper.slug}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <h2 className="text-sm font-extrabold">{scraper.name}</h2>
                    <p className="mt-1 text-xs text-muted">
                      Cron: {scraper.schedule} · Pubblicate:{" "}
                      {stats.bySource[scraper.slug] || 0}
                      {last
                        ? ` · Ultima: ${new Date(last.finishedAt).toLocaleString("it-IT")} (${last.found} trovate)`
                        : ""}
                    </p>
                    {failed && last?.error ? (
                      <p className="mt-1 text-xs text-danger">{last.error}</p>
                    ) : null}
                  </div>
                  <span
                    className={`tag w-fit ${failed ? "tag-danger" : "tag-primary"}`}
                  >
                    {failed ? "Errore" : "Attivo"}
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-extrabold tracking-[-0.03em]">
            Storico recente
          </h2>
          <div className="content-card mt-4 overflow-hidden">
            <div className="divide-y divide-border">
              {runs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">
                  Non ci sono ancora esecuzioni registrate.
                </p>
              ) : (
                runs.map((run) => (
                  <article
                    key={run.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{run.source}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {run.found} trovate
                        {run.created != null ? ` · ${run.created} nuove` : ""}
                        {run.updated != null ? ` · ${run.updated} aggiornate` : ""}
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
                        {run.status === "ok" ? "OK" : "Errore"}
                      </p>
                      <p className="mt-1">
                        {new Date(run.finishedAt).toLocaleString("it-IT")}
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
