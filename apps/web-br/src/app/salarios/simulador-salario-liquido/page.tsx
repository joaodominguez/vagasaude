import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NetSalarySimulator } from "@/components/net-salary-simulator";
import { SOURCES, SALARY_YEAR } from "@/lib/salary-tables";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";

const title = `Simulador de salário líquido CLT ${SALARY_YEAR} (INSS e IRRF)`;
const description =
  "Calcule o salário líquido a partir do bruto com a tabela do INSS 2026 e o IRRF com a nova isenção até R$ 5.000 (Lei 15.270/2025). Para enfermeiros, técnicos, médicos e demais profissionais de saúde.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios/simulador-salario-liquido" },
  openGraph: { title, description, url: "/salarios/simulador-salario-liquido", type: "website", siteName: SITE_NAME, locale: "pt_BR" },
};

const SOURCE_LIST = [SOURCES.inss, SOURCES.receita, SOURCES.lei15270, SOURCES.salarioMinimo];

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
              Simulador de salário líquido CLT {SALARY_YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Informe o salário bruto mensal e o número de dependentes para estimar quanto sobra
              depois do INSS e do Imposto de Renda na fonte, com as regras de {SALARY_YEAR}.
            </p>
          </div>
        </section>
        <div className="page-container space-y-6 py-10">
          <NetSalarySimulator />
          <section className="content-card p-5 text-sm leading-6 text-muted">
            <h2 className="text-lg font-extrabold text-foreground">Como calculamos</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>INSS do empregado, progressivo: 7,5% até R$ 1.621,00; 9% até R$ 2.902,84; 12% até R$ 4.354,27; 14% até o teto de R$ 8.475,55 (contribuição máxima de R$ 988,09).</li>
              <li>IRRF: tabela mensal (isento até R$ 2.428,80; alíquotas de 7,5% a 27,5%), com dedução de R$ 189,59 por dependente e opção pelo desconto simplificado de R$ 607,20 quando for maior que as deduções legais.</li>
              <li>Redução da Lei 15.270/2025: zera o imposto de quem ganha até R$ 5.000 e diminui gradualmente até R$ 7.350 (redução = R$ 978,62 − 0,133145 × rendimento); acima disso não há redução.</li>
            </ul>
          </section>
          <p className="text-xs leading-5 text-muted">
            Fontes:{" "}
            {SOURCE_LIST.map((source, index) => (
              <span key={source.url}>
                {index > 0 && "; "}
                <a href={source.url} className="underline" rel="noopener" target="_blank">
                  {source.label}
                </a>
              </span>
            ))}
            . Resultado é uma estimativa; o valor do holerite pode variar conforme o empregador.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
