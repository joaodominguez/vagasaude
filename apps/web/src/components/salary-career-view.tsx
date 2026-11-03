import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NetSalarySimulator } from "@/components/net-salary-simulator";
import type { getPrivateSalaryData } from "@/lib/salary-observatory";
import {
  careerEntry,
  careerRange,
  formatEur,
  netMonthly,
  SALARY_SOURCES,
  SALARY_YEAR,
  type Career,
} from "@/lib/salary-tables";
import { SITE_NAME, truncateMeta } from "@/lib/seo";

type PrivateData = Awaited<ReturnType<typeof getPrivateSalaryData>>;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildCareerSalaryMetadata(career: Career): Metadata {
  const entry = careerEntry(career);
  const net = netMonthly(entry.gross).net;
  const title = `Salário de ${career.label} em ${SALARY_YEAR}: tabela do SNS e líquido`;
  const description = truncateMeta(
    `Quanto ganha um ${career.label} em Portugal: ${formatEur(entry.gross)} brutos no início da carreira no SNS (cerca de ${formatEur(net)} líquidos). Tabela completa por categoria e posição, salários no privado e simulador.`,
    160,
  );
  const url = `/salarios/${career.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_PT" },
  };
}

export function SalaryCareerView({
  career,
  privateData,
  jobsHref,
}: {
  career: Career;
  privateData: PrivateData;
  jobsHref: string;
}) {
  const entry = careerEntry(career);
  const entryNet = netMonthly(entry.gross);
  const range = careerRange(career);
  const faq = [
    {
      q: `Quanto ganha um ${career.label} no início da carreira?`,
      a: `No SNS, a 1.ª posição da categoria de ${entry.category.toLowerCase()} corresponde a ${formatEur(entry.gross)} brutos por mês (${career.regime}), cerca de ${formatEur(entryNet.net)} líquidos para um contribuinte não casado e sem dependentes. Recebe 14 vezes por ano.`,
    },
    {
      q: `Qual é o salário máximo de um ${career.label} no SNS?`,
      a: `Na tabela de ${SALARY_YEAR}, os valores da carreira vão de ${formatEur(range.min)} a ${formatEur(range.max)} brutos por mês, consoante a categoria e a posição remuneratória.`,
    },
    ...(privateData
      ? [
          {
            q: `E no privado, quanto se paga a um ${career.label}?`,
            a: `Nos ${privateData.count} anúncios do privado com salário que analisámos nos últimos 6 meses, o valor mediano é ${formatEur(privateData.median)} brutos por mês (metade entre ${formatEur(privateData.p25)} e ${formatEur(privateData.p75)}).`,
          },
        ]
      : []),
  ];

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs
              items={[
                { label: "Início", href: "/" },
                { label: "Salários", href: "/salarios" },
                { label: capitalize(career.label) },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Salário de {career.label} em {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {career.intro} No início da carreira no SNS, um {career.label} ganha{" "}
              <strong className="text-foreground">{formatEur(entry.gross)} brutos</strong> por mês
              (cerca de <strong className="text-foreground">{formatEur(entryNet.net)} líquidos</strong>).
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Início no SNS</p>
              <p className="mt-2 text-2xl font-extrabold">{formatEur(entry.gross)}</p>
              <p className="mt-1 text-sm text-muted">bruto · {formatEur(entryNet.net)} líquido</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tabela do SNS</p>
              <p className="mt-2 text-2xl font-extrabold">
                {formatEur(range.min)} – {formatEur(range.max)}
              </p>
              <p className="mt-1 text-sm text-muted">bruto mensal · {career.regime}</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">No privado</p>
              <p className="mt-2 text-2xl font-extrabold">
                {privateData ? formatEur(privateData.median) : "—"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {privateData ? `mediana de ${privateData.count} anúncios` : "poucos anúncios com salário"}
              </p>
            </div>
          </div>

          {career.includes && (
            <p className="text-sm leading-6 text-muted">
              Inclui: {career.includes.join(", ")}.
            </p>
          )}

          {career.categories.map((category) => (
            <section key={category.name} className="content-card overflow-x-auto p-5">
              <h2 className="text-lg font-extrabold">{category.name}</h2>
              <table className="mt-4 w-full min-w-[30rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="pb-2 font-extrabold">Posição</th>
                    <th className="pb-2 font-extrabold">Nível TRU</th>
                    <th className="pb-2 text-right font-extrabold">Bruto mensal</th>
                    <th className="pb-2 text-right font-extrabold">Líquido estimado</th>
                    <th className="pb-2 text-right font-extrabold">Bruto anual (14×)</th>
                  </tr>
                </thead>
                <tbody>
                  {category.positions.map((position) => (
                    <tr key={position.position} className="border-t border-border">
                      <td className="py-2.5">{category.positions.length > 1 ? `${position.position}.ª` : "—"}</td>
                      <td className="py-2.5 text-muted">{position.level}</td>
                      <td className="py-2.5 text-right font-semibold">{formatEur(position.gross)}</td>
                      <td className="py-2.5 text-right">{formatEur(netMonthly(position.gross).net)}</td>
                      <td className="py-2.5 text-right text-muted">{formatEur(position.gross * 14)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {privateData && privateData.recent.length > 0 && (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Vagas no privado com salário anunciado</h2>
              <ul className="mt-3 divide-y divide-border">
                {privateData.recent.map((ad) => (
                  <li key={ad.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <Link href={`/vagas/${ad.slug}`} className="font-semibold hover:text-primary">
                        {ad.title}
                      </Link>
                      <span className="block text-sm text-muted">
                        {ad.company} · {ad.district}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-primary">{ad.salaryText}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-extrabold">Calcula o teu salário líquido</h2>
            <NetSalarySimulator initialGross={entry.gross} />
          </section>

          <Link href={jobsHref} className="button button-secondary inline-flex">
            Ver vagas de {career.label}
          </Link>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Perguntas frequentes</h2>
            <div className="mt-4 space-y-5">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs leading-5 text-muted">
            Fontes:{" "}
            {SALARY_SOURCES.map((source, index) => (
              <span key={source.url}>
                {index > 0 && "; "}
                <a href={source.url} className="underline" rel="noopener" target="_blank">
                  {source.label}
                </a>
              </span>
            ))}
            . Valores brutos ilíquidos; o líquido é uma estimativa para não casado sem dependentes
            (continente).
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
