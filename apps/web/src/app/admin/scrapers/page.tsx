import { getJobStats } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const SCRAPERS = [
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
];

export default async function AdminScrapersPage() {
  const stats = await getJobStats();

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
            {SCRAPERS.map((scraper) => (
              <article
                key={scraper.slug}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <h2 className="text-sm font-extrabold">{scraper.name}</h2>
                  <p className="mt-1 text-xs text-muted">
                    Cron: {scraper.schedule} · Publicadas:{" "}
                    {stats.bySource[scraper.slug] || 0}
                  </p>
                </div>
                <span className="tag tag-primary w-fit">Ativo</span>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-5 text-sm leading-6 text-muted">
          A execução manual e o histórico detalhado de erros entram na próxima
          iteração do backoffice. Por agora a recolha corre via cron no
          servidor.
        </p>
      </div>
    </main>
  );
}
