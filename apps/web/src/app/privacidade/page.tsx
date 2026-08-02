import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Privacidade",
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
            O VagaSaúde recolhe apenas os dados necessários para prestar os
            serviços pedidos, como o endereço de email usado na criação de
            alertas.
          </p>
          <h2>Alertas de vagas</h2>
          <p>
            O email é utilizado exclusivamente para enviar oportunidades e
            comunicações relacionadas com o alerta. Não vendemos dados pessoais
            nem os partilhamos para publicidade de terceiros.
          </p>
          <h2>Cancelamento e eliminação</h2>
          <p>
            Podes pedir o cancelamento do alerta ou a eliminação dos teus dados
            através de <a href="mailto:privacidade@vagasaude.pt">privacidade@vagasaude.pt</a>.
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
