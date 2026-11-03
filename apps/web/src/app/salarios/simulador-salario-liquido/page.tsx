import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NetSalarySimulator } from "@/components/net-salary-simulator";
import { SALARY_SOURCES, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

const title = `Simulador de salário líquido ${SALARY_YEAR} para profissionais de saúde`;
const description =
  "Calcula o salário líquido a partir do bruto com as tabelas de retenção na fonte de IRS de 2026 e os descontos para a Segurança Social ou CGA. Para enfermeiros, médicos, técnicos e auxiliares.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios/simulador-salario-liquido" },
  openGraph: { title, description, url: "/salarios/simulador-salario-liquido", type: "website", siteName: SITE_NAME, locale: "pt_PT" },
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
                { label: "Início", href: "/" },
                { label: "Salários", href: "/salarios" },
                { label: "Simulador de salário líquido" },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Simulador de salário líquido {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Indica o salário bruto mensal e a situação familiar para estimar quanto recebes por
              mês, com as tabelas de retenção na fonte de IRS em vigor em {SALARY_YEAR} e 11% de
              descontos para a Segurança Social ou a CGA.
            </p>
          </div>
        </section>
        <div className="page-container space-y-6 py-10">
          <NetSalarySimulator />
          <p className="text-xs leading-5 text-muted">
            Fonte: <a className="underline" href={SALARY_SOURCES[1].url} rel="noopener" target="_blank">{SALARY_SOURCES[1].label}</a>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
