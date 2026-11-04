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
  formatEurRound,
  netSalary,
  SALARY_SOURCES,
  SALARY_YEAR,
  type Career,
  type PayRow,
} from "@/lib/salary-tables";
import { SITE_NAME, truncateMeta } from "@/lib/seo";

type PrivateData = Awaited<ReturnType<typeof getPrivateSalaryData>>;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function netOf(annual: number) {
  return netSalary({
    annualGross: annual,
    payments: 14,
    household: "single",
    children: 0,
    childrenUnder3: 0,
    contract: "indefinido",
  });
}

export function buildCareerSalaryMetadata(career: Career): Metadata {
  const entry = careerEntry(career);
  const net = netOf(entry.annual).netMonthlyEquivalent;
  const title = `Sueldo de ${career.label} en ${SALARY_YEAR}: tablas oficiales y neto`;
  const description = truncateMeta(
    `Cuánto cobra un ${career.label} en España: desde ${formatEurRound(entry.monthlyEquivalent)} brutos al mes (unos ${formatEurRound(net)} netos) según las tablas oficiales de los servicios de salud. Tablas por servicio de salud, sueldos en ofertas privadas y simulador de neto.`,
    160,
  );
  const url = `/salarios/${career.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "es_ES" },
  };
}

function RowCells({ row }: { row: PayRow }) {
  const net = netOf(row.annual).netMonthlyEquivalent;
  const source = SALARY_SOURCES[row.source];
  return (
    <>
      <td className="py-2.5 pr-3">
        <span className="font-semibold">{row.service}</span>
        <span className="block text-xs text-muted">
          {row.year}
          {row.note ? ` · ${row.note}` : ""}
        </span>
      </td>
      <td className="py-2.5 text-right">{formatEur(row.base)}</td>
      <td className="py-2.5 text-right">{row.destination === null ? "—" : formatEur(row.destination)}</td>
      <td className="py-2.5 text-right">{row.specific === null ? "—" : formatEur(row.specific)}</td>
      <td className="py-2.5 text-right font-semibold">{formatEur(row.monthly)}</td>
      <td className="py-2.5 text-right text-muted">{row.extra === null ? "—" : formatEur(row.extra)}</td>
      <td className="py-2.5 text-right text-muted">
        {row.estimated ? "≈ " : ""}
        {formatEurRound(row.annual)}
      </td>
      <td className="py-2.5 text-right">{formatEurRound(net)}</td>
      <td className="py-2.5 pl-3 text-xs">
        <a href={source.url} className="underline" rel="noopener" target="_blank">
          Fuente
        </a>
      </td>
    </>
  );
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
  const entryNet = netOf(entry.annual);
  const range = careerRange(career);
  const hasAds = !!privateData && privateData.recent.length > 0;
  const usedSources = [
    ...new Set(career.tables.flatMap((t) => t.rows.map((r) => r.source))),
  ] as Array<keyof typeof SALARY_SOURCES>;
  const faq = [
    {
      q: `¿Cuánto cobra un ${career.label} en el sistema público?`,
      a: `Según las tablas oficiales verificadas, el bruto anual equivale a entre ${formatEurRound(range.min)} y ${formatEurRound(range.max)} al mes (total anual entre 12, con las pagas extra prorrateadas), sin trienios, carrera profesional ni guardias. Varía de un servicio de salud a otro porque cada comunidad fija su complemento específico.`,
    },
    {
      q: `¿Cuál es el sueldo mínimo verificado de un ${career.label}?`,
      a: `La tabla con el importe más bajo que hemos verificado (${entry.row.service}, ${entry.row.year}) suma ${formatEurRound(entry.annual)} brutos al año, es decir ${formatEurRound(entry.monthlyEquivalent)} al mes en 12 pagas (unos ${formatEurRound(entryNet.netMonthlyEquivalent)} netos para soltero sin hijos con contrato indefinido). No es el mínimo de toda España: hay comunidades que no hemos podido verificar.`,
    },
    {
      q: "¿Las pagas extra están incluidas?",
      a: "En las tablas, el «total mensual» es la paga ordinaria (12 al año) y las dos pagas extra (junio y diciembre) se muestran aparte. El bruto anual suma las 14 pagas; el neto mensual equivalente es el neto anual dividido entre 12.",
    },
    ...(privateData
      ? [
          {
            q: `¿Y en el sector privado, cuánto se paga a un ${career.label}?`,
            a: `En las ${privateData.count} ofertas privadas con sueldo que hemos analizado en los últimos 6 meses, el valor mediano es ${formatEurRound(privateData.median)} brutos al mes (la mitad, entre ${formatEurRound(privateData.p25)} y ${formatEurRound(privateData.p75)}). Los importes anuales se dividen entre 12.`,
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
                { label: "Inicio", href: "/" },
                { label: "Salarios", href: "/salarios" },
                { label: capitalize(career.label) },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Sueldo de {career.label} en {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {career.intro} La tabla pública verificada más baja equivale a{" "}
              <strong className="text-foreground">{formatEurRound(entry.monthlyEquivalent)} brutos</strong> al mes
              (unos <strong className="text-foreground">{formatEurRound(entryNet.netMonthlyEquivalent)} netos</strong>).
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Mínimo verificado</p>
              <p className="mt-2 text-2xl font-extrabold">{formatEurRound(entry.monthlyEquivalent)}</p>
              <p className="mt-1 text-sm text-muted">
                bruto/mes (anual ÷ 12) · {formatEurRound(entryNet.netMonthlyEquivalent)} neto
              </p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tablas públicas</p>
              <p className="mt-2 text-2xl font-extrabold">
                {formatEurRound(range.min)} – {formatEurRound(range.max)}
              </p>
              <p className="mt-1 text-sm text-muted">bruto/mes (anual ÷ 12) · según servicio de salud</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">En ofertas privadas</p>
              <p className="mt-2 text-2xl font-extrabold">
                {privateData ? formatEurRound(privateData.median) : "—"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {privateData ? `mediana de ${privateData.count} ofertas` : "pocas ofertas con sueldo"}
              </p>
            </div>
          </div>

          {hasAds && privateData && (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Ofertas abiertas con sueldo</h2>
              <ul className="mt-3 divide-y divide-border">
                {privateData.recent.map((ad) => (
                  <li key={ad.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <Link href={`/empleo/${ad.slug}`} className="font-semibold hover:text-primary">
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
              <Link href={jobsHref} className="button button-secondary mt-4 inline-flex">
                Ver todas las ofertas de {career.label}
              </Link>
            </section>
          )}

          {career.tables.map((table) => (
            <section key={table.name} className="content-card overflow-x-auto p-5">
              <h2 className="text-lg font-extrabold">{table.name}</h2>
              <table className="mt-4 w-full min-w-[56rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="pb-2 font-extrabold">Servicio de salud / convenio</th>
                    <th className="pb-2 text-right font-extrabold">Sueldo base</th>
                    <th className="pb-2 text-right font-extrabold">C. destino</th>
                    <th className="pb-2 text-right font-extrabold">C. específico y otros</th>
                    <th className="pb-2 text-right font-extrabold">Total mensual (12 pagas)</th>
                    <th className="pb-2 text-right font-extrabold">Paga extra</th>
                    <th className="pb-2 text-right font-extrabold">Bruto anual (14 pagas)</th>
                    <th className="pb-2 text-right font-extrabold">Neto est. (÷ 12)</th>
                    <th className="pb-2 pl-3 font-extrabold" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={`${row.service}-${row.year}-${row.monthly}`} className="border-t border-border align-top">
                      <RowCells row={row} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {!hasAds && (
            <Link href={jobsHref} className="button button-secondary inline-flex">
              Ver ofertas de {career.label}
            </Link>
          )}

          <section>
            <h2 className="mb-3 text-lg font-extrabold">Calcula tu sueldo neto</h2>
            <NetSalarySimulator initialAnnual={entry.annual} />
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Preguntas frecuentes</h2>
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
            Fuentes:{" "}
            {[...usedSources, "cotizacion", "irpf"].map((key, index) => {
              const source = SALARY_SOURCES[key as keyof typeof SALARY_SOURCES];
              return (
                <span key={key}>
                  {index > 0 && "; "}
                  <a href={source.url} className="underline" rel="noopener" target="_blank">
                    {source.label}
                  </a>
                </span>
              );
            })}
            . Importes brutos, sin trienios, carrera profesional, guardias ni turnicidad. «≈» indica un
            anual estimado (12 × mensual + 2 pagas extra de sueldo base y complemento de destino) cuando la
            fuente solo da el mensual. El neto es una estimación para soltero/a sin hijos con contrato
            indefinido.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
