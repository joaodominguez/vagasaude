import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como o VagaSaúde agrega vagas de saúde, como funcionam os alertas e onde você se candidata.",
  alternates: { canonical: "/como-funciona" },
  openGraph: {
    title: "Como funciona | VagaSaúde",
    description:
      "Como o VagaSaúde agrega vagas de saúde, como funcionam os alertas e onde você se candidata.",
    url: "/como-funciona",
    type: "website",
  },
};

const FAQ = [
  {
    q: "O VagaSaúde é um site de recrutamento?",
    a: "Não. Somos um agregador: reunimos ofertas de saúde publicadas por hospitais, grupos privados, entidades filantrópicas e fontes públicas. A candidatura é feita sempre no site oficial da entidade.",
  },
  {
    q: "Como me candidato a uma vaga?",
    a: "Abra a vaga no VagaSaúde, confira os detalhes e use o botão de candidatura. Você é encaminhado para a página da entidade empregadora — não enviamos currículos nem processamos candidaturas.",
  },
  {
    q: "De onde vêm as vagas?",
    a: "De portais de emprego e sites de hospitais, clínicas, rede pública (SUS) e entidades filantrópicas no Brasil. Atualizamos as fontes regularmente e removemos anúncios expirados.",
  },
  {
    q: "Como funcionam os alertas?",
    a: "Você escolhe filtros (estado, profissão, setor), confirma o email e recebe um aviso quando surgir uma vaga nova que coincida. Pode gerenciar ou cancelar o alerta a qualquer momento a partir do email.",
  },
  {
    q: "Por que só vejo vagas de saúde?",
    a: "É a especialização do produto: enfermagem, medicina, técnicos, auxiliares e funções do ecossistema de saúde (formação, farma, gestão hospitalar). Assim a pesquisa fica mais rápida e com menos ruído.",
  },
  {
    q: "Os dados estão corretos?",
    a: "Fazemos o melhor para normalizar título, local e profissão, mas a fonte oficial prevalece. Se encontrar um erro, o anúncio original da entidade é a referência.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page mx-auto max-w-3xl">
          <p className="section-kicker">Transparência</p>
          <h1>Como funciona</h1>
          <p>
            O VagaSaúde existe para poupar tempo a quem procura emprego em
            saúde no Brasil: um site simples, atualizado, com filtros que
            fazem sentido para a área.
          </p>

          <h2>Em 3 passos</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[0.98rem] leading-7 text-muted">
            <li>
              <strong className="text-foreground">Pesquise</strong> por
              profissão, estado ou palavra-chave.
            </li>
            <li>
              <strong className="text-foreground">Consulte</strong> o anúncio e
              confirme localização, setor e requisitos.
            </li>
            <li>
              <strong className="text-foreground">Candidate-se</strong> no site
              da entidade — nós só fazemos a ponte.
            </li>
          </ol>

          <h2>Perguntas frequentes</h2>
          <div className="mt-4 space-y-5">
            {FAQ.map((item) => (
              <section key={item.q}>
                <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                  {item.q}
                </h3>
                <p className="mt-1.5 text-[0.98rem] leading-7 text-muted">
                  {item.a}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/vagas" className="button button-primary">
              Ver vagas
            </Link>
            <Link href="/alertas" className="button button-secondary">
              Criar alerta
            </Link>
            <Link href="/artigos" className="button button-secondary">
              Guias de candidatura
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
