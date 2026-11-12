import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import type { getPrivateSalaryData } from "@/lib/salary-observatory";
import {
  careerEntry,
  careerRange,
  formatEurRound,
  SALARY_YEAR,
  type Career,
  type PayRow,
} from "@/lib/salary-tables";
import { SITE_NAME, truncateMeta } from "@/lib/seo";

type PrivateData = Awaited<ReturnType<typeof getPrivateSalaryData>>;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildCareerSalaryMetadata(career: Career): Metadata {
  const entry = careerEntry(career);
  const title = `Stipendio ${career.label} nel ${SALARY_YEAR}: tabelle ufficiali`;
  const description = truncateMeta(
    `Quanto guadagna un ${career.label} in Italia: a partire da ${formatEurRound(entry.monthlyEquivalent)} lordi al mese secondo le tabelle retributive pubbliche, con fonti e retribuzioni indicate negli annunci del settore privato.`,
    160,
  );
  const url = `/stipendi/${career.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "it_IT" },
  };
}

function RowCells({ row }: { row: PayRow }) {
  return (
    <>
      <td className="py-2.5 pr-3">
        <span className="font-semibold">{row.service}</span>
        <span className="block text-xs text-muted">
          {row.year}
          {row.note ? ` · ${row.note}` : ""}
        </span>
      </td>
      <td className="py-2.5 text-right font-semibold">{formatEurRound(row.annual / 12)}</td>
      <td className="py-2.5 text-right text-muted">{formatEurRound(row.annual)}</td>
      <td className="py-2.5 pl-3 text-xs">
        <a href={row.source.url} className="underline" rel="noopener" target="_blank">
          Fonte
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
  const range = careerRange(career);
  const hasAds = !!privateData && privateData.recent.length > 0;
  const sources = [
    ...new Map(
      career.tables.flatMap((t) => t.rows.map((r) => [r.source.url, r.source] as const)),
    ).values(),
  ];
  const faq = [
    {
      q: `Quanto guadagna un ${career.label} nel settore pubblico?`,
      a: `Secondo le tabelle ufficiali verificate, il lordo annuo equivale a un valore compreso tra ${formatEurRound(range.min)} e ${formatEurRound(range.max)} al mese (totale annuo diviso 12), esclusi indennità, anzianità e turni.`,
    },
    {
      q: `Qual è la retribuzione minima verificata di un ${career.label}?`,
      a: `La tabella con l'importo più basso tra quelle verificate (${entry.row.service}, ${entry.row.year}) indica ${formatEurRound(entry.annual)} lordi l'anno, cioè ${formatEurRound(entry.monthlyEquivalent)} al mese. Non è un minimo valido per tutta Italia: possono esistere altri contratti non verificati.`,
    },
    ...(privateData
      ? [
          {
            q: `E nel settore privato, quanto guadagna un ${career.label}?`,
            a: `Negli ${privateData.count} annunci privati con retribuzione analizzati negli ultimi 6 mesi, il valore mediano è ${formatEurRound(privateData.median)} lordi al mese (la metà tra ${formatEurRound(privateData.p25)} e ${formatEurRound(privateData.p75)}). Gli importi annui sono divisi per 12.`,
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
                { label: "Home", href: "/" },
                { label: "Stipendi", href: "/stipendi" },
                { label: capitalize(career.label) },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Stipendio {career.label} nel {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {career.intro} La tabella pubblica verificata più bassa equivale a{" "}
              <strong className="text-foreground">{formatEurRound(entry.monthlyEquivalent)} lordi</strong> al mese.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Minimo verificato</p>
              <p className="mt-2 text-2xl font-extrabold">{formatEurRound(entry.monthlyEquivalent)}</p>
              <p className="mt-1 text-sm text-muted">lordi/mese (annuo ÷ 12)</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tabelle pubbliche</p>
              <p className="mt-2 text-2xl font-extrabold">
                {formatEurRound(range.min)} – {formatEurRound(range.max)}
              </p>
              <p className="mt-1 text-sm text-muted">lordi/mese (annuo ÷ 12)</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Negli annunci privati</p>
              <p className="mt-2 text-2xl font-extrabold">
                {privateData ? formatEurRound(privateData.median) : "—"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {privateData ? `mediana di ${privateData.count} annunci` : "pochi annunci con retribuzione"}
              </p>
            </div>
          </div>

          {hasAds && privateData && (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Offerte aperte con retribuzione</h2>
              <ul className="mt-3 divide-y divide-border">
                {privateData.recent.map((ad) => (
                  <li key={ad.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <Link href={`/offerte/${ad.slug}`} className="font-semibold hover:text-primary">
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
                Vedi tutte le offerte per {career.label}
              </Link>
            </section>
          )}

          {career.tables.map((table) => (
            <section key={table.name} className="content-card overflow-x-auto p-5">
              <h2 className="text-lg font-extrabold">{table.name}</h2>
              <table className="mt-4 w-full min-w-[30rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="pb-2 font-extrabold">Contratto / ente</th>
                    <th className="pb-2 text-right font-extrabold">Lordo mensile (÷ 12)</th>
                    <th className="pb-2 text-right font-extrabold">Lordo annuo</th>
                    <th className="pb-2 pl-3 font-extrabold" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={`${row.service}-${row.year}-${row.annual}`} className="border-t border-border align-top">
                      <RowCells row={row} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {!hasAds && (
            <Link href={jobsHref} className="button button-secondary inline-flex">
              Vedi le offerte per {career.label}
            </Link>
          )}

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Domande frequenti</h2>
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
            Fonti:{" "}
            {sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 && "; "}
                <a href={source.url} className="underline" rel="noopener" target="_blank">
                  {source.label}
                </a>
              </span>
            ))}
            . Importi lordi, esclusi anzianità, indennità, turni e reperibilità.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
