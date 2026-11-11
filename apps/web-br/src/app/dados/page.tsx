import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getMarketPanorama, type PanoramaRow } from "@/lib/market-panorama";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = "Mercado de trabalho na saúde: panorama das vagas no Brasil";
const description =
  "Quantas vagas de saúde estão abertas no Brasil, em que estados, para que profissões, com que contratos e quais empregadores mais contratam. Dados atualizados todos os dias a partir de vagas reais.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/dados" },
  openGraph: { title, description, url: "/dados", type: "website", siteName: SITE_NAME, locale: "pt_BR" },
};

const int = (value: number) => value.toLocaleString("pt-BR");
const pct = (share: number) =>
  share > 0 && share < 0.001
    ? "<0,1%"
    : share.toLocaleString("pt-BR", {
    style: "percent",
    minimumFractionDigits: share > 0 && share < 0.1 ? 1 : 0,
    maximumFractionDigits: share > 0 && share < 0.1 ? 1 : 0,
  });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="content-card p-4">
      <p className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{label}</p>
    </div>
  );
}

function RowsTable({
  heading,
  caption,
  rows,
  labelHeader,
}: {
  heading: string;
  caption?: string;
  rows: PanoramaRow[];
  labelHeader: string;
}) {
  const max = rows.reduce((m, row) => Math.max(m, row.share), 0);
  return (
    <section className="content-card overflow-x-auto p-5">
      <h2 className="text-lg font-extrabold">{heading}</h2>
      {caption && <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>}
      <table className="mt-4 w-full min-w-[20rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="pb-2 font-extrabold">{labelHeader}</th>
            <th className="pb-2 text-right font-extrabold">Vagas</th>
            <th className="pb-2 pl-3 text-right font-extrabold">% do total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border align-middle">
              <td className="py-2.5 pr-3">
                {row.href ? (
                  <Link prefetch={false} href={row.href} className="font-semibold text-primary hover:underline">
                    {row.label}
                  </Link>
                ) : (
                  <span className="font-semibold">{row.label}</span>
                )}
                <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-primary-soft" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max(max ? (row.share / max) * 100 : 0, 1.5)}%` }}
                  />
                </div>
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{int(row.count)}</td>
              <td className="py-2.5 pl-3 text-right text-muted tabular-nums">{pct(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function DataPage() {
  const data = await getMarketPanorama();
  const dateLabel = data.generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const citation = `Fonte: ${SITE_NAME}, “Mercado de trabalho na saúde: panorama das vagas no Brasil” (vagasaude.com.br/dados), dados de ${dateLabel}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Panorama das vagas de emprego na saúde no Brasil",
    description: `Número de vagas de emprego na área da saúde abertas no Brasil, por estado, profissão, setor, tipo de contrato e empregador, calculado diariamente a partir das vagas ativas reunidas pelo ${SITE_NAME} (sites de carreira de hospitais, redes de saúde, laboratórios, farmácias e plataformas de recrutamento). Inclui a porcentagem de vagas com salário mensal anunciado. Não inclui concursos públicos.`,
    url: absoluteUrl("/dados"),
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
    inLanguage: "pt-BR",
    spatialCoverage: { "@type": "Place", name: "Brasil" },
    temporalCoverage: isoDate,
    dateModified: data.generatedAt.toISOString(),
    variableMeasured: [
      "Vagas ativas por estado",
      "Vagas ativas por profissão",
      "Vagas ativas por empregador",
      "Vagas ativas por setor",
      "Vagas ativas por tipo de contrato",
      "Porcentagem de vagas com salário anunciado",
    ],
    keywords: ["vagas saúde", "mercado de trabalho saúde", "emprego enfermagem", "vagas por estado"],
  };

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Dados" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Mercado de trabalho na saúde: panorama das vagas no Brasil
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Quantas vagas de saúde estão abertas agora, em que estados, para que profissões e
              quem mais contrata. Os números vêm das vagas ativas que o {SITE_NAME} reúne de
              hospitais, redes de saúde, laboratórios e farmácias, e são atualizados todos os dias.
              Dados de <strong>{dateLabel}</strong>.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={int(data.total)} label="vagas abertas na saúde" />
            <Stat value={int(data.companies)} label="empregadores com vagas" />
            <Stat value={int(data.lastWeek)} label="vagas publicadas nos últimos 7 dias" />
            <Stat value={pct(data.withSalaryShare)} label="das vagas anunciam o salário" />
          </div>

          <RowsTable
            heading="Vagas por estado"
            caption={`As ${int(data.total)} vagas abertas, em ${data.states} unidades da federação; “Brasil” reúne as vagas nacionais ou remotas, sem estado definido.`}
            labelHeader="Estado"
            rows={data.byState}
          />

          <RowsTable
            heading="Vagas por profissão"
            caption={
              data.professions > data.byProfession.length
                ? `As ${data.byProfession.length} áreas com mais vagas, de ${data.professions} no total.`
                : `As ${data.professions} áreas, da que tem mais vagas para a que tem menos.`
            }
            labelHeader="Profissão"
            rows={data.byProfession}
          />

          <RowsTable
            heading="Empregadores com mais vagas"
            caption={`Os 15 empregadores com mais vagas abertas. Veja todos os ${data.employerPages} com página própria em Empresas.`}
            labelHeader="Empregador"
            rows={data.topEmployers}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <RowsTable heading="Por setor" labelHeader="Setor" rows={data.bySector} />
            <RowsTable
              heading="Por tipo de contrato"
              caption="Como indicado pelo empregador; muitas vagas não informam o contrato."
              labelHeader="Contrato"
              rows={data.byContract}
            />
          </div>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Salários</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              {int(data.withSalary)} das {int(data.total)} vagas ({pct(data.withSalaryShare)}) anunciam um
              salário mensal. Veja quanto pagam, função a função e por estado, e como os valores
              anunciados se comparam com o piso nacional da enfermagem, em{" "}
              <Link href="/salarios" className="font-semibold text-primary hover:underline">
                Salários na saúde
              </Link>
              .
            </p>
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Como citar estes dados</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Você pode usar estes números livremente em reportagens, artigos e trabalhos, desde que
              indique a fonte com link para esta página:
            </p>
            <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6">
              {citation}
            </p>
          </section>

          <section className="text-sm leading-7 text-muted">
            <h2 className="text-base font-extrabold">Metodologia</h2>
            <p className="mt-2">
              Contamos as vagas ativas no {SITE_NAME} no momento da atualização, vindas de{" "}
              {data.sources} fontes: sites de carreira de hospitais e redes de saúde, laboratórios,
              redes de farmácias e plataformas de recrutamento. Cada vaga conta uma vez: republicações
              da mesma vaga são agrupadas, e vagas encerradas ou sem atualização há mais de 7 dias
              deixam de contar. Concursos públicos não estão incluídos. O estado, a profissão, o setor
              e o tipo de contrato seguem a informação da própria vaga; “Não informado” quer dizer que
              a vaga não indica o contrato. O salário só conta quando a vaga anuncia um valor mensal.
              Os números mudam ao longo do dia, à medida que as vagas são atualizadas.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
