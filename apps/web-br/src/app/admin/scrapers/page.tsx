import { getJobStats } from "@/lib/job-store";
import { latestRunBySource, listScraperRuns } from "@/lib/scraper-runs";
import { JOB_SOURCES } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SCRAPERS = JOB_SOURCES.map((source) => ({
  slug: source.id,
  name: source.name,
  schedule: "A cada 6 horas",
}));

export default async function AdminScrapersPage() {
  const [stats, latest, runs] = await Promise.all([
    getJobStats(),
    latestRunBySource(),
    listScraperRuns(40),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="section-kicker">Brasil · scrapers</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">
          Fontes e corridas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Dados só em <code className="text-xs">/var/www/vagasaudebr/data</code>
          . Publicadas: {stats.published} · total: {stats.total}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fonte</th>
              <th className="px-4 py-3">Agenda</th>
              <th className="px-4 py-3">Última corrida</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {SCRAPERS.map((scraper) => {
              const run = latest.get(scraper.slug);
              return (
                <tr key={scraper.slug} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{scraper.name}</td>
                  <td className="px-4 py-3 text-muted">{scraper.schedule}</td>
                  <td className="px-4 py-3 text-muted">
                    {run?.finishedAt || run?.startedAt || "—"}
                  </td>
                  <td className="px-4 py-3">{run?.status || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-bold">Corridas recentes</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem corridas registadas.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {runs.map((run) => (
              <li
                key={`${run.source}-${run.startedAt}`}
                className="rounded-lg border border-border px-3 py-2"
              >
                <strong>{run.source}</strong> · {run.status} ·{" "}
                {run.finishedAt || run.startedAt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
