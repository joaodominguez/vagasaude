import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { CAREERS, careerEntry, careerRange, formatEur, netMonthly, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

const title = `Salários na saúde em ${SALARY_YEAR}: tabelas do SNS e privado`;
const description =
  "Quanto ganham enfermeiros, médicos, técnicos de diagnóstico e terapêutica, técnicos auxiliares de saúde e farmacêuticos em Portugal: tabelas salariais do SNS, salários no privado e simulador de líquido.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios" },
  openGraph: { title, description, url: "/salarios", type: "website", siteName: SITE_NAME, locale: "pt_PT" },
};

export default function SalariesIndexPage() {
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
              Tabelas salariais oficiais das carreiras do SNS, com o líquido estimado, e salários
              anunciados no privado nas vagas que agregamos.
            </p>
          </div>
        </section>
        <div className="page-container grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
          {CAREERS.map((career) => {
            const entry = careerEntry(career);
            const range = careerRange(career);
            return (
              <Link key={career.slug} href={`/salarios/${career.slug}`} className="content-card p-5 hover:border-primary">
                <h2 className="font-extrabold">{career.label.charAt(0).toUpperCase() + career.label.slice(1)}</h2>
                <p className="mt-2 text-sm text-muted">Início no SNS</p>
                <p className="text-xl font-extrabold">{formatEur(entry.gross)}</p>
                <p className="text-sm text-muted">
                  {formatEur(netMonthly(entry.gross).net)} líquido · até {formatEur(range.max)}
                </p>
              </Link>
            );
          })}
          <Link href="/salarios/simulador-salario-liquido" className="content-card p-5 hover:border-primary">
            <h2 className="font-extrabold">Simulador de salário líquido</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Do bruto ao líquido com as tabelas de retenção de IRS de {SALARY_YEAR}.
            </p>
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
