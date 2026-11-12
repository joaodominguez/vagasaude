import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getMarketPanorama, type PanoramaRow } from "@/lib/market-panorama";
import { hasSalaryData } from "@/lib/salary-tables";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = "Mercato del lavoro sanitario: panorama delle offerte di lavoro in Italia";
const description =
  "Quante offerte di lavoro sanitarie sono aperte in Italia, in quali regioni, per quali professioni, con quali contratti e quali datori di lavoro assumono di più. Dati aggiornati ogni giorno a partire da offerte reali.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/dati" },
  openGraph: { title, description, url: "/dati", type: "website", siteName: SITE_NAME, locale: "it_IT" },
};

const int = (value: number) => value.toLocaleString("it-IT");
const pct = (share: number) =>
  share > 0 && share < 0.001
    ? "<0,1%"
    : share.toLocaleString("it-IT", {
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
            <th className="pb-2 text-right font-extrabold">Offerte</th>
            <th className="pb-2 pl-3 text-right font-extrabold">% del totale</th>
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
  const dateLabel = data.generatedAt.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const citation = `Fonte: ${SITE_NAME}, «Mercato del lavoro sanitario: panorama delle offerte di lavoro in Italia» (${SITE_URL.replace(/^https?:\/\//, "")}/dati), dati del ${dateLabel}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Panorama delle offerte di lavoro sanitarie in Italia",
    description: `Numero di offerte di lavoro sanitarie aperte in Italia, per regione, professione, settore, tipo di contratto e datore di lavoro, calcolato ogni giorno a partire dalle offerte attive raccolte da ${SITE_NAME} (portali di lavoro di aziende sanitarie, ospedali, strutture private, RSA e bandi pubblici). Include la percentuale di offerte con retribuzione mensile indicata.`,
    url: absoluteUrl("/dati"),
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
    inLanguage: "it-IT",
    spatialCoverage: { "@type": "Place", name: "Italia" },
    temporalCoverage: isoDate,
    dateModified: data.generatedAt.toISOString(),
    variableMeasured: [
      "Offerte attive per regione",
      "Offerte attive per professione",
      "Offerte attive per datore di lavoro",
      "Offerte attive per settore",
      "Offerte attive per tipo di contratto",
      "Percentuale di offerte con retribuzione indicata",
    ],
    keywords: ["lavoro sanitario", "mercato del lavoro sanità", "lavoro infermieri", "offerte per regione"],
  };

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Dati" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Mercato del lavoro sanitario: panorama delle offerte di lavoro in Italia
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Quante offerte di lavoro sanitarie sono aperte adesso, in quali regioni, per quali
              professioni e chi assume di più. I numeri derivano dalle offerte attive che {SITE_NAME}
              raccoglie da aziende sanitarie, ospedali, strutture private, RSA e bandi pubblici, e
              vengono aggiornati ogni giorno. Dati del <strong>{dateLabel}</strong>.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={int(data.total)} label="offerte di lavoro sanitarie aperte" />
            <Stat value={int(data.companies)} label="datori di lavoro con offerte" />
            <Stat value={int(data.lastWeek)} label="offerte pubblicate negli ultimi 7 giorni" />
            <Stat value={pct(data.withSalaryShare)} label="delle offerte indica la retribuzione" />
          </div>

          <RowsTable
            heading="Offerte per regione"
            caption={`Le ${int(data.total)} offerte aperte, in ${data.states} regioni; «Italia» raccoglie le offerte nazionali o da remoto, senza regione definita.`}
            labelHeader="Regione"
            rows={data.byState}
          />

          <RowsTable
            heading="Offerte per professione"
            caption={
              data.professions > data.byProfession.length
                ? `Le ${data.byProfession.length} aree con più offerte, su ${data.professions} in totale.`
                : `Tutte le ${data.professions} aree, da quella con più offerte a quella con meno.`
            }
            labelHeader="Professione"
            rows={data.byProfession}
          />

          <RowsTable
            heading="Datori di lavoro con più offerte"
            caption={`I 15 datori di lavoro con più offerte aperte. Consulta i ${data.employerPages} con pagina dedicata in Aziende.`}
            labelHeader="Datore di lavoro"
            rows={data.topEmployers}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <RowsTable heading="Per settore" labelHeader="Sector" rows={data.bySector} />
            <RowsTable
              heading="Per tipo di contratto"
              caption="Secondo quanto indicato dal datore di lavoro; molte offerte non indicano il contratto."
              labelHeader="Contratto"
              rows={data.byContract}
            />
          </div>

          {data.withSalary > 0 ? (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Stipendi</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                {int(data.withSalary)} offerte su {int(data.total)} ({pct(data.withSalaryShare)}) indicano
                una retribuzione mensile.
                {hasSalaryData() ? (
                  <>
                    {" "}Scopri quanto si guadagna, professione per professione, e il confronto con le
                    tabelle dei contratti collettivi in{" "}
                    <Link href="/stipendi" className="font-semibold text-primary hover:underline">
                      Stipendi nella sanità
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            </section>
          ) : null}

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Come citare questi dati</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Puoi usare questi numeri liberamente in articoli, servizi e lavori, purché citi la
              fonte con un link a questa pagina:
            </p>
            <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6">
              {citation}
            </p>
          </section>

          <section className="text-sm leading-7 text-muted">
            <h2 className="text-base font-extrabold">Metodologia</h2>
            <p className="mt-2">
              Contiamo le offerte attive su {SITE_NAME} al momento dell&apos;aggiornamento, provenienti
              da {data.sources} fonti: portali di lavoro di aziende sanitarie e ospedali, strutture
              private, RSA e bandi pubblici. Ogni offerta conta una sola volta: le ripubblicazioni
              della stessa offerta vengono raggruppate e le offerte chiuse o non aggiornate da più di
              7 giorni non vengono contate. Regione, professione, settore e tipo di contratto
              seguono le informazioni dell&apos;offerta stessa; «Non indicato» significa che l&apos;offerta non
              specifica il contratto. La retribuzione conta solo quando l&apos;offerta indica un importo
              mensile. I numeri cambiano nel corso della giornata, man mano che le offerte vengono
              aggiornate.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
