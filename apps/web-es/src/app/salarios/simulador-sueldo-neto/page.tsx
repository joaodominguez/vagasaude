import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NetSalarySimulator } from "@/components/net-salary-simulator";
import { SALARY_SOURCES, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

const title = `Simulador de sueldo neto ${SALARY_YEAR} para profesionales sanitarios`;
const description =
  "Calcula el sueldo neto a partir del bruto anual con la Seguridad Social 2026 y la retención de IRPF de la AEAT. Estimación para enfermeros, médicos, TCAE, técnicos y otros profesionales sanitarios.";
const path = "/salarios/simulador-sueldo-neto";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "es_ES" },
};

export default function NetSalarySimulatorPage() {
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
                { label: "Simulador de sueldo neto" },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Simulador de sueldo neto {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Indica el sueldo bruto anual, el número de pagas y tu situación familiar para estimar
              cuánto cobras al mes, con las cotizaciones a la Seguridad Social de {SALARY_YEAR} y la
              retención de IRPF según el procedimiento de la AEAT.
            </p>
          </div>
        </section>
        <div className="page-container space-y-6 py-10">
          <NetSalarySimulator />
          <p className="text-xs leading-5 text-muted">
            Fuentes:{" "}
            <a className="underline" href={SALARY_SOURCES.cotizacion.url} rel="noopener" target="_blank">
              {SALARY_SOURCES.cotizacion.label}
            </a>
            ;{" "}
            <a className="underline" href={SALARY_SOURCES.irpf.url} rel="noopener" target="_blank">
              {SALARY_SOURCES.irpf.label}
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
