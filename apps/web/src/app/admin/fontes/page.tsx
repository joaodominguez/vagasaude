import { getJobStats } from "@/lib/job-store";
import { SOURCE_META } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const stats = await getJobStats();
  const sources = Object.keys({
    ...SOURCE_META,
    ...Object.fromEntries(Object.keys(stats.bySource).map((k) => [k, true])),
  });

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Recolha</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Fontes
          </h1>
          <p className="mt-1 text-sm text-muted">
            Origens privadas ligadas neste momento.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {sources.map((source) => {
            const meta = SOURCE_META[source] || {
              name: source,
              url: "#",
              sector: "—",
            };
            const count = stats.bySource[source] || 0;
            return (
              <article key={source} className="content-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold">{meta.name}</h2>
                    <p className="mt-1 text-xs text-muted">{source}</p>
                  </div>
                  <span className="tag tag-primary">{count} vagas</span>
                </div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Setor</dt>
                    <dd className="font-semibold">{meta.sector}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Estado</dt>
                    <dd className="font-semibold text-success">Ativa</dd>
                  </div>
                </dl>
                {meta.url !== "#" && (
                  <a
                    href={meta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
                  >
                    Abrir origem
                  </a>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
