import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getPrivateSalaryData, SALARY_MIN_SAMPLE } from "@/lib/salary-observatory";
import {
  CAREERS,
  careerEntry,
  formatEurRound,
  hasSalaryData,
  SALARY_YEAR,
} from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = `Stipendi nella sanità nel ${SALARY_YEAR}: tabelle ufficiali e settore privato`;
const description =
  "Quanto si guadagna nella sanità in Italia: tabelle retributive ufficiali dei contratti collettivi, con fonte, e retribuzioni indicate negli annunci privati. Una pagina per professione.";

// Senza dati verificati la pagina resta raggiungibile ma non indicizzata.
export const metadata: Metadata = hasSalaryData()
  ? {
      title,
      description,
      alternates: { canonical: "/stipendi" },
      openGraph: { title, description, url: "/stipendi", type: "website", siteName: SITE_NAME, locale: "it_IT" },
    }
  : {
      title: "Stipendi nella sanità",
      description: "Dati sugli stipendi nella sanità in Italia: sezione in preparazione.",
      alternates: { canonical: "/stipendi" },
      robots: { index: false, follow: true },
    };

export default async function SalariesIndexPage() {
  if (!hasSalaryData()) {
    return (
      <>
        <Header />
        <main className="min-h-[70vh]">
          <section className="border-b border-border bg-surface py-8">
            <div className="page-container">
              <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Stipendi" }]} />
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
                Stipendi nella sanità
              </h1>
            </div>
          </section>
          <div className="page-container py-10">
            <section className="content-card p-6">
              <h2 className="text-lg font-extrabold">Dati sugli stipendi in preparazione</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
                Stiamo raccogliendo le tabelle retributive dei contratti collettivi della sanità
                da fonti pubbliche verificabili. Preferiamo non mostrare cifre finché non possiamo
                indicarne la fonte.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/offerte" className="button button-primary">
                  Vedi le offerte
                </Link>
                <Link href="/avvisi" className="button button-secondary">
                  Crea un avviso
                </Link>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const rows = await Promise.all(
    CAREERS.map(async (career) => ({
      career,
      entry: careerEntry(career),
      privateData: await getPrivateSalaryData(career),
    })),
  );

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Stipendi" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Stipendi nella sanità nel {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Le tabelle retributive ufficiali dei contratti collettivi e le retribuzioni indicate
              negli annunci privati che raccogliamo ogni giorno. Gli importi sono lordi al mese,
              con il totale annuo (tredicesima inclusa) diviso 12. Per le professioni della dirigenza il riferimento di partenza include le componenti fisse del contratto (esclusività, specificità, posizione minima), non solo lo stipendio tabellare.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <section className="content-card overflow-x-auto p-5">
            <h2 className="text-lg font-extrabold">Per professione</h2>
            <table className="mt-4 w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Professione</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Partenza SSN</th>
                  <th className="pb-2 pl-3 font-extrabold">Contratto</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Privato (mediana)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ career, entry, privateData }) => (
                  <tr key={career.slug} className="border-t border-border">
                    <td className="py-2.5 pr-3">
                      <Link href={`/stipendi/${career.slug}`} className="font-semibold text-primary hover:underline">
                        {career.label.charAt(0).toUpperCase() + career.label.slice(1)}
                      </Link>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold">{formatEurRound(entry.monthlyEquivalent)}</td>
                    <td className="py-2.5 pl-3 text-xs text-muted">{career.ssn.contract}</td>
                    <td className="py-2.5 pl-3 text-right text-muted">
                      {privateData ? `${formatEurRound(privateData.median)} (${privateData.count})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-sm leading-6 text-muted">
            Metodologia: mostriamo solo le tabelle ufficiali (ARAN e Gazzetta Ufficiale) che abbiamo potuto verificare alla
            fonte primaria, con anno e link, e omettiamo i contratti senza tabella verificata. Le
            retribuzioni private sono importi mensili lordi indicati negli ultimi 6 mesi (quelli
            annui sono divisi per 12), con almeno {SALARY_MIN_SAMPLE} annunci per professione; non
            includiamo importi orari, forbici vaghe, tirocini né valori sotto i 1.000 €/mese.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
