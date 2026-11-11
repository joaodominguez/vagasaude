import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LEGAL_OWNER } from "@/lib/legal-owner";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";

const title = "Contato e identificação";
const description =
  "Como entrar em contato com o VagaSaúde: sugestões, correções de vagas, pedidos de empresas, imprensa e dados pessoais. Identificação do responsável pelo site.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contato" },
  openGraph: { title, description, url: "/contato", type: "website", siteName: SITE_NAME, locale: "pt_BR" },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Contato" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Contato e identificação</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {"O VagaSaúde é um agregador gratuito de vagas na área da saúde. Não recrutamos nem recebemos candidaturas: para se candidatar, abra a vaga e siga o link para o site da empresa que a publicou."}
            </p>
          </div>
        </section>

        <div className="page-container max-w-3xl space-y-4 py-10">
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Fale com a gente</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Sugestões, erros em uma vaga, pedidos de remoção ou outras dúvidas: escreva para "}<a className="font-semibold text-primary hover:underline" href="mailto:contato@vagasaude.com.br">contato@vagasaude.com.br</a>{". Respondemos o mais rápido possível."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Empresas e instituições</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Se uma vaga da sua empresa está desatualizada ou deve ser retirada, envie o link da vaga no VagaSaúde para "}<a className="font-semibold text-primary hover:underline" href="mailto:contato@vagasaude.com.br">contato@vagasaude.com.br</a>{"."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Imprensa e dados</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Os números do mercado de trabalho na saúde estão na "}<Link className="font-semibold text-primary hover:underline" href="/dados">página de dados</Link>{" e podem ser citados com indicação da fonte. Para outros pedidos, use o mesmo e-mail."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Dados pessoais</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Para exercer seus direitos sobre dados pessoais (alertas por e-mail, por exemplo), escreva para "}<a className="font-semibold text-primary hover:underline" href="mailto:privacidade@vagasaude.com.br">privacidade@vagasaude.com.br</a>{" ou consulte a "}<Link className="font-semibold text-primary hover:underline" href="/privacidade">política de privacidade</Link>{"."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Responsável pelo site</h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-6">
              <li><span className="text-muted">Titular:</span> {LEGAL_OWNER.name}</li>
              <li><span className="text-muted">NIF:</span> {LEGAL_OWNER.taxId}</li>
              <li><span className="text-muted">Endereço:</span> {LEGAL_OWNER.address}</li>
              <li>
                <span className="text-muted">E-mail:</span>{" "}
                <a className="font-semibold text-primary hover:underline" href={`mailto:${LEGAL_OWNER.email}`}>
                  {LEGAL_OWNER.email}
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
