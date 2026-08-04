import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como o VagaSaúde agrega vagas de saúde, como funcionam os alertas e onde te candidatas.",
  alternates: { canonical: "/como-funciona" },
  openGraph: {
    title: "Como funciona | VagaSaúde",
    description:
      "Como o VagaSaúde agrega vagas de saúde, como funcionam os alertas e onde te candidatas.",
    url: "/como-funciona",
    type: "website",
  },
};

const FAQ = [
  {
    q: "O VagaSaúde é um site de recrutamento?",
    a: "Não. Somos um agregador: reunimos ofertas de saúde publicadas por hospitais, grupos privados, IPSS e fontes públicas. A candidatura faz-se sempre no site oficial da entidade.",
  },
  {
    q: "Como me candidato a uma vaga?",
    a: "Abre a vaga no VagaSaúde, confirma os detalhes e usa o botão de candidatura. És encaminhado para a página da entidade empregadora — não enviamos currículos nem processamos candidaturas.",
  },
  {
    q: "De onde vêm as vagas?",
    a: "De fontes públicas (como BEP e Diário da República) e portais de empregadores de saúde (hospitais, clínicas, IPSS e grupos privados). Actualizamos as fontes regularmente e removemos anúncios expirados.",
  },
  {
    q: "Como funcionam os alertas?",
    a: "Escolhes filtros (distrito, profissão, setor), confirms o email e recebes um aviso quando surgir uma vaga nova que coincida. Podes gerir ou cancelar o alerta a qualquer momento a partir do email.",
  },
  {
    q: "Porque é que só vejo vagas de saúde?",
    a: "É a especialização do produto: enfermagem, medicina, técnicos, auxiliares e funções do ecossistema de saúde (formação, farma, gestão hospitalar). Assim a pesquisa fica mais rápida e com menos ruído.",
  },
  {
    q: "Os dados estão correctos?",
    a: "Fazemos o melhor para normalizar título, local e profissão, mas a fonte oficial prevalece. Se encontrares um erro, o anúncio original da entidade é a referência.",
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
            saúde em Portugal: um sítio simples, actualizado, com filtros que
            fazem sentido para a área.
          </p>

          <h2>Em 3 passos</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[0.98rem] leading-7 text-muted">
            <li>
              <strong className="text-foreground">Pesquisa</strong> por
              profissão, distrito ou palavra-chave.
            </li>
            <li>
              <strong className="text-foreground">Consulta</strong> o anúncio e
              confirma localização, setor e requisitos.
            </li>
            <li>
              <strong className="text-foreground">Candidata-te</strong> no site
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
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
