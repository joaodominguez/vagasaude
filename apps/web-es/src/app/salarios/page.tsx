import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getPrivateSalaryData, SALARY_MIN_SAMPLE } from "@/lib/salary-observatory";
import { CAREERS, careerEntry, careerRange, formatEurRound, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = `Salarios en sanidad en ${SALARY_YEAR}: tablas oficiales y sector privado`;
const description =
  "Cuánto cobran enfermeros, médicos, TCAE, técnicos sanitarios, fisioterapeutas, celadores y farmacéuticos en España: tablas retributivas de los servicios de salud, sueldos en ofertas privadas y simulador de sueldo neto.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios" },
  openGraph: { title, description, url: "/salarios", type: "website", siteName: SITE_NAME, locale: "es_ES" },
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
            <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Salarios" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Salarios en sanidad en {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Cuánto se cobra de verdad en sanidad en España: las tablas retributivas oficiales de los
              servicios de salud, con el neto estimado, y los sueldos anunciados en las ofertas
              privadas que agregamos cada día. Los importes son brutos al mes con el total anual
              dividido entre 12.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <section className="content-card overflow-x-auto p-5">
            <h2 className="text-lg font-extrabold">Por profesión</h2>
            <table className="mt-4 w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Profesión</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Mínimo verificado</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-extrabold">Tablas públicas</th>
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
                    <td className="py-2.5 pl-3 text-right font-semibold">{formatEurRound(entry.monthlyEquivalent)}</td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right text-muted">
                      {formatEurRound(range.min)} – {formatEurRound(range.max)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-muted">
                      {privateData ? `${formatEurRound(privateData.median)} (${privateData.count})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Herramientas</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/salarios/simulador-sueldo-neto" className="filter-chip">
                Simulador de sueldo neto {SALARY_YEAR}
              </Link>
            </div>
          </section>

          <p className="text-sm leading-6 text-muted">
            Metodología: en España no hay una tabla única, cada servicio de salud fija su complemento
            específico, así que mostramos solo las tablas oficiales que hemos podido verificar en la
            fuente primaria (INGESA, IB-Salut, informe del Ministerio de Sanidad sobre TCAE y los
            convenios publicados en el BOE) con su año y enlace, y omitimos las comunidades sin tabla
            verificada. Los sueldos privados son importes mensuales brutos anunciados en los últimos 6
            meses (los anuales se dividen entre 12), con al menos {SALARY_MIN_SAMPLE} ofertas por
            profesión; no incluimos importes por hora, bandas vagas, prácticas ni valores por debajo
            de 1.000 €/mes.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
