import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Política de privacidade do VagaSaúde: quais dados coletamos e como os usamos.",
  alternates: { canonical: "/privacidade" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Transparência</p>
          <h1>Privacidade</h1>
          <p>
            O VagaSaúde coleta apenas os dados necessários para prestar os
            serviços solicitados, como o endereço de email usado na criação de
            alertas.
          </p>
          <h2>Alertas de vagas</h2>
          <p>
            O email é utilizado exclusivamente para enviar oportunidades e
            comunicações relacionadas ao alerta. Não vendemos dados pessoais
            nem os compartilhamos para publicidade de terceiros.
          </p>
          <h2>Cancelamento e exclusão</h2>
          <p>
            Você pode pedir o cancelamento do alerta ou a exclusão dos seus dados
            através de{" "}
            <a href="mailto:privacidade@vagasaude.com.br">
              privacidade@vagasaude.com.br
            </a>
            .
          </p>
          <h2>Candidaturas</h2>
          <p>
            As candidaturas são realizadas nos sites das entidades
            empregadoras. O VagaSaúde não recebe nem armazena currículos nesta
            versão.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
