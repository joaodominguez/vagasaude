import { getJobStats } from "@/lib/job-store";
import { latestRunBySource, listScraperRuns } from "@/lib/scraper-runs";

export const dynamic = "force-dynamic";

const SCRAPERS = [
  {
    slug: "bep",
    name: "BEP — Bolsa de Emprego Público",
    schedule: "A cada 6 horas",
  },
  {
    slug: "dre",
    name: "Diário da República (avisos Série II)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "iefp",
    name: "IEFP (ofertas saúde)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "ipo_porto",
    name: "IPO Porto (emprego)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "scml",
    name: "Santa Casa Misericórdia Lisboa",
    schedule: "A cada 6 horas",
  },
  {
    slug: "scm_esposende",
    name: "Santa Casa Misericórdia Esposende",
    schedule: "A cada 6 horas",
  },
  {
    slug: "cuf",
    name: "CUF (Teamtailor)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "luz_saude",
    name: "Luz Saúde (CVWarehouse)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "trofa_saude",
    name: "Trofa Saúde (VNC API)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "lusiadas",
    name: "Lusíadas (CVWarehouse)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "joaquim_chaves",
    name: "Joaquim Chaves Saúde (Harpoon)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "champalimaud",
    name: "Champalimaud (get-offers)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "germano_de_sousa",
    name: "Germano de Sousa (HTML)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "hpa",
    name: "Grupo HPA Saúde (HTML)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "holon",
    name: "Farmácias Holon (CVWarehouse)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "aefful",
    name: "AEFFUL — Farmácia comunitária (HTML)",
    schedule: "A cada 6 horas",
  },
  {
    slug: "pharmabsc",
    name: "PHARMABSC — Recrutamento farmácia (WordPress)",
    schedule: "A cada 6 horas",
  },
];

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
          <p className="section-kicker">Automação</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Scrapers
          </h1>
          <p className="mt-1 text-sm text-muted">
            Última atualização dos dados:{" "}
            {stats.updatedAt
              ? new Date(stats.updatedAt).toLocaleString("pt-PT")
              : "—"}
          </p>
        </header>

        <section className="content-card mt-8 overflow-hidden">
          <div className="divide-y divide-border">
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
                      Cron: {scraper.schedule} · Publicadas:{" "}
                      {stats.bySource[scraper.slug] || 0}
                      {last
                        ? ` · Última: ${new Date(last.finishedAt).toLocaleString("pt-PT")} (${last.found} encontradas)`
                        : ""}
                    </p>
                    {failed && last?.error ? (
                      <p className="mt-1 text-xs text-danger">{last.error}</p>
                    ) : null}
                  </div>
                  <span
                    className={`tag w-fit ${failed ? "tag-danger" : "tag-primary"}`}
                  >
                    {failed ? "Erro" : "Ativo"}
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-extrabold tracking-[-0.03em]">
            Histórico recente
          </h2>
          <div className="content-card mt-4 overflow-hidden">
            <div className="divide-y divide-border">
              {runs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">
                  Ainda não há execuções registadas.
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
                        {run.found} encontradas
                        {run.created != null ? ` · ${run.created} novas` : ""}
                        {run.updated != null ? ` · ${run.updated} atualizadas` : ""}
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
                        {new Date(run.finishedAt).toLocaleString("pt-PT")}
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
