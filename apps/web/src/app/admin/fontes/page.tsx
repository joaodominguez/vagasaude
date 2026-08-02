import { getJobStats } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const SOURCE_META: Record<
  string,
  { name: string; url: string; sector: string }
> = {
  bep: {
    name: "BEP — Bolsa de Emprego Público",
    url: "https://www.bep.gov.pt/pages/oferta/Oferta_Pesquisa_basica.aspx",
    sector: "Público",
  },
  cuf: {
    name: "CUF / José de Mello",
    url: "https://carreiras.cuf.pt/",
    sector: "Privado",
  },
  luz_saude: {
    name: "Luz Saúde",
    url: "https://www.hospitaldaluz.pt/",
    sector: "Privado",
  },
  trofa_saude: {
    name: "Trofa Saúde",
    url: "https://recrutamento.grupovnc.com/trofasaude/",
    sector: "Privado",
  },
  lusiadas: {
    name: "Lusíadas",
    url: "https://www.lusiadas.pt/",
    sector: "Privado",
  },
  joaquim_chaves: {
    name: "Joaquim Chaves Saúde",
    url: "https://recrutamento.jcs.pt/Offers",
    sector: "Privado",
  },
  champalimaud: {
    name: "Fundação Champalimaud",
    url: "https://www.fchampalimaud.org/pt-pt/posicoes-em-aberto",
    sector: "Privado",
  },
  germano_de_sousa: {
    name: "Grupo Germano de Sousa",
    url: "https://www.germanodesousa.com/contactos/ofertas-de-emprego/",
    sector: "Privado",
  },
};

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
