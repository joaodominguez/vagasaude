import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getPrivateSalaryData, SALARY_MIN_SAMPLE } from "@/lib/salary-observatory";
import { CAREERS, careerEntry, careerRange, formatEur, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = `Salários na saúde em ${SALARY_YEAR}: tabelas do SNS e privado`;
const description =
  "Quanto ganham enfermeiros, médicos, técnicos de diagnóstico e terapêutica, técnicos auxiliares de saúde e farmacêuticos em Portugal: tabelas salariais do SNS, salários no privado e simulador de líquido.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios" },
  openGraph: { title, description, url: "/salarios", type: "website", siteName: SITE_NAME, locale: "pt_PT" },
};

export default async function SalariesIndexPage() {
  const rows = await Promise.all(
    CAREERS.map(async (career) => ({
      career,
      entry: careerEntry(career),
      range: careerRange(career),
      privateData: await getPrivateSalaryData(career),
    })),
  );

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Salários" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Salários na saúde em {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Quanto se ganha, de facto, na saúde em Portugal: as tabelas salariais oficiais das
              carreiras do SNS, com o líquido estimado, e os salários anunciados no privado nas
              vagas que agregamos todos os dias.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <section className="content-card overflow-x-auto p-5">
            <h2 className="text-lg font-extrabold">Por carreira</h2>
            <table className="mt-4 w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Carreira</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Início no SNS</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-extrabold">Tabela do SNS</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Privado (mediana)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ career, entry, range, privateData }) => (
                  <tr key={career.slug} className="border-t border-border">
                    <td className="py-2.5 pr-3">
                      <Link href={`/salarios/${career.slug}`} className="font-semibold text-primary hover:underline">
                        {career.label.charAt(0).toUpperCase() + career.label.slice(1)}
                      </Link>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold">{formatEur(entry.gross)}</td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right text-muted">
                      {formatEur(range.min)} – {formatEur(range.max)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-muted">
                      {privateData ? `${formatEur(privateData.median)} (${privateData.count})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Ferramentas</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link prefetch={false} href="/salarios/simulador-salario-liquido" className="filter-chip">
                Simulador de salário líquido {SALARY_YEAR}
              </Link>
            </div>
          </section>

          <p className="text-sm leading-6 text-muted">
            Metodologia: tabelas oficiais do SNS para {SALARY_YEAR} (DGAEP, Sistema Remuneratório
            da Administração Pública) e salários mensais brutos anunciados no privado nos últimos 6
            meses, com pelo menos {SALARY_MIN_SAMPLE} anúncios por carreira. Não incluímos valores
            por hora, estágios, escalões genéricos nem anúncios abaixo do salário mínimo.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
