import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LEGAL_OWNER } from "@/lib/legal-owner";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";

const title = "Contacto e identificação";
const description =
  "Como contactar o VagaSaúde: sugestões, correções de vagas, pedidos de entidades, imprensa e dados pessoais. Identificação do responsável pelo site.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contacto" },
  openGraph: { title, description, url: "/contacto", type: "website", siteName: SITE_NAME, locale: "pt_PT" },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Contacto" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Contacto e identificação</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {"O VagaSaúde é um agregador gratuito de vagas na área da saúde. Não recrutamos nem recebemos candidaturas: para te candidatares, abre a vaga e segue o link para o site da entidade que a publicou."}
            </p>
          </div>
        </section>

        <div className="page-container max-w-3xl space-y-4 py-10">
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Fala connosco</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Sugestões, erros numa vaga, pedidos de remoção ou outras questões: escreve-nos para "}<a className="font-semibold text-primary hover:underline" href="mailto:contacto@vagasaude.pt">contacto@vagasaude.pt</a>{". Respondemos o mais depressa possível."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Entidades empregadoras</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Se uma vaga da tua entidade está desatualizada ou queres que seja retirada, envia-nos o link da vaga no VagaSaúde para "}<a className="font-semibold text-primary hover:underline" href="mailto:contacto@vagasaude.pt">contacto@vagasaude.pt</a>{"."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Imprensa e dados</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Os números do mercado de trabalho na saúde estão na "}<Link className="font-semibold text-primary hover:underline" href="/dados">página de dados</Link>{" e podem ser citados com indicação da fonte. Para outros pedidos, usa o mesmo email."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Dados pessoais</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{"Para exercer os teus direitos sobre dados pessoais (alertas por email, por exemplo), escreve para "}<a className="font-semibold text-primary hover:underline" href="mailto:privacidade@vagasaude.pt">privacidade@vagasaude.pt</a>{" ou consulta a "}<Link className="font-semibold text-primary hover:underline" href="/privacidade">política de privacidade</Link>{"."}</p>
          </section>
          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Responsável pelo site</h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-6">
              <li><span className="text-muted">Titular:</span> {LEGAL_OWNER.name}</li>
              <li><span className="text-muted">NIF:</span> {LEGAL_OWNER.taxId}</li>
              <li><span className="text-muted">Morada:</span> {LEGAL_OWNER.address}</li>
              <li>
                <span className="text-muted">Email:</span>{" "}
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
