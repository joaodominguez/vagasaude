import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { articlesSorted } from "@/content/articles";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Artigos — guias de emprego na saúde",
  description:
    "Guias práticos para candidaturas em saúde no Brasil: currículo, carta de apresentação, editais de concurso e alertas de emprego.",
  alternates: { canonical: "/artigos" },
  openGraph: {
    title: `Artigos — guias de emprego na saúde | ${SITE_NAME}`,
    description:
      "Currículo, carta de apresentação, concursos públicos e alertas — para quem busca emprego em enfermagem, medicina e afins no Brasil.",
    url: "/artigos",
    type: "website",
    siteName: SITE_NAME,
    locale: "pt_BR",
  },
};

export default function ArticlesIndexPage() {
  const list = articlesSorted();

  return (
    <>
      <Header />
      <main className="page-container py-14">
        <div className="mx-auto max-w-3xl">
          <p className="section-kicker">Guias</p>
          <h1 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-extrabold tracking-[-0.045em] text-foreground">
            Artigos para candidaturas em saúde
          </h1>
          <p className="mt-3 max-w-2xl text-[1.02rem] leading-7 text-muted">
            Textos curtos sobre currículo, carta, editais e alertas — pensados
            para enfermagem, técnico de enfermagem, medicina e o restante do
            ecossistema de saúde no Brasil. Sem floreios: o objetivo é você se
            candidatar melhor.
          </p>

          <ul className="mt-10 space-y-3">
            {list.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/artigos/${article.slug}`}
                  className="content-card block rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/35"
                >
                  <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-primary">
                    {article.eyebrow} · {article.readMinutes} min
                  </p>
                  <strong className="mt-1.5 block text-lg font-extrabold tracking-[-0.02em] text-foreground">
                    {article.title}
                  </strong>
                  <span className="mt-1.5 block text-[0.95rem] leading-6 text-muted">
                    {article.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/vagas" className="button button-primary">
              Ver vagas
            </Link>
            <Link href="/alertas" className="button button-secondary">
              Criar alerta
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
