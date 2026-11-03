import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { formatBRL } from "@/lib/salary-benchmarks";
import { SITE_NAME } from "@/lib/seo";
import { listSalaryPages, SALARY_MIN_SAMPLE } from "@/lib/salary-observatory";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = "Salários na saúde em 2026: quanto pagam as vagas reais";
const description =
  "Salários de técnico de enfermagem, enfermeiro, farmacêutico, recepcionista e outras funções da saúde, calculados a partir de vagas reais com salário anunciado pelos empregadores.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/salarios" },
  openGraph: { title, description, url: "/salarios", type: "website", siteName: SITE_NAME, locale: "pt_BR" },
};

function money(value: number) {
  return formatBRL(Math.round(value / 10) * 10);
}

export default async function SalariesIndexPage() {
  const pages = await listSalaryPages();
  const roles = pages.filter((page) => !page.district);
  const states = pages.filter((page) => page.district);

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Salários" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Salários na saúde em 2026
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Quanto pagam, de verdade, as vagas de saúde no Brasil. Calculamos os valores a
              partir de vagas reais com salário anunciado pelos próprios empregadores —
              hospitais, clínicas, laboratórios e redes de farmácias — e atualizamos todos os dias.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <section className="content-card overflow-x-auto p-5">
            <h2 className="text-lg font-extrabold">Por função</h2>
            <table className="mt-4 w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Função</th>
                  <th className="pb-2 text-right font-extrabold">Salário mediano</th>
                  <th className="pb-2 text-right font-extrabold">Faixa típica</th>
                  <th className="pb-2 text-right font-extrabold">Vagas</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((page) => (
                  <tr key={page.path} className="border-t border-border">
                    <td className="py-2.5 pr-3">
                      <Link href={page.path} className="font-semibold text-primary hover:underline">
                        {page.role.label.charAt(0).toUpperCase() + page.role.label.slice(1)}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{money(page.stats.median)}</td>
                    <td className="py-2.5 text-right text-muted">
                      {money(page.stats.p25)} – {money(page.stats.p75)}
                    </td>
                    <td className="py-2.5 text-right text-muted">{page.stats.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {states.length > 0 && (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Por função e estado</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {states.map((page) => (
                  <Link key={page.path} href={page.path} className="filter-chip">
                    {page.role.label} em {page.district} · {money(page.stats.median)}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <p className="text-sm leading-6 text-muted">
            Metodologia: salários mensais brutos anunciados nas vagas dos últimos 6 meses, com
            pelo menos {SALARY_MIN_SAMPLE} vagas por página. Não incluímos concursos com vários cargos no mesmo
            edital, residências, estágios, nem valores por hora ou plantão.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
