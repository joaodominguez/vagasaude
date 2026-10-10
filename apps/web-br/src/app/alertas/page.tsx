import type { Metadata } from "next";
import { BellRing, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Criar alerta de vagas",
  description:
    "Receba por email as novas oportunidades de emprego em saúde que correspondem aos seus interesses.",
  alternates: { canonical: "/alertas" },
  openGraph: {
    title: "Criar alerta de vagas | VagaSaúde",
    description:
      "Receba por email as novas oportunidades de emprego em saúde que correspondem aos seus interesses.",
    url: "/alertas",
    type: "website",
  },
};

export default function AlertsPage() {
  return (
    <>
      <Header />
      <main className="page-container grid min-h-[72vh] items-center gap-10 py-14 lg:grid-cols-[1fr_26rem] lg:py-20">
        <section>
          <span className="eyebrow">
            <BellRing size={15} />
            Alertas gratuitos
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.055em] sm:text-5xl">
            Não deixe passar a próxima oportunidade.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Informe onde podemos contatá-lo e receba as novas vagas de saúde
            assim que forem publicadas.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              [MailCheck, "Direto no email", "Sem precisar visitar vários sites."],
              [CheckCircle2, "Vagas relevantes", "Só oportunidades na área da saúde."],
              [ShieldCheck, "Controle total", "Cancele quando quiser."],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof MailCheck;
              return (
                <div key={title as string} className="feature-card">
                  <ItemIcon size={21} className="text-primary" />
                  <h2 className="mt-3 text-sm font-extrabold">{title as string}</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {copy as string}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="content-card p-6 shadow-[var(--shadow)] sm:p-8">
          <span className="feature-icon">
            <BellRing size={23} />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">
            Criar o meu alerta
          </h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-muted">
            Escolha estado, profissão ou setor (opcional) e confirme o email
            para ativar. Você pode alterar ou cancelar a qualquer momento.
          </p>
          <AlertForm />
        </aside>
      </main>
      <Footer />
    </>
  );
}
