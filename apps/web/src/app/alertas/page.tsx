import type { Metadata } from "next";
import { BellRing, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Criar alerta de vagas",
  description:
    "Recebe por email as novas oportunidades de emprego em saúde que correspondem aos teus interesses.",
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
            Não deixes passar a próxima oportunidade.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Diz-nos onde te podemos contactar e recebe as novas vagas de saúde
            assim que forem publicadas.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              [MailCheck, "Direto no email", "Sem teres de visitar vários sites."],
              [CheckCircle2, "Vagas relevantes", "Só oportunidades na área da saúde."],
              [ShieldCheck, "Controlo total", "Cancela quando quiseres."],
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
            Nesta primeira versão recebes todas as novas oportunidades. Os
            filtros personalizados chegam em breve.
          </p>
          <AlertForm />
        </aside>
      </main>
      <Footer />
    </>
  );
}
