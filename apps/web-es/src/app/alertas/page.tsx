import type { Metadata } from "next";
import { BellRing, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Crear alerta de empleo",
  description:
    "Recibe por email las nuevas oportunidades de empleo sanitario que encajan con tus intereses.",
  alternates: { canonical: "/alertas" },
  openGraph: {
    title: "Crear alerta de empleo | VacantesSalud",
    description:
      "Recibe por email las nuevas oportunidades de empleo sanitario que encajan con tus intereses.",
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
            Alertas gratuitas
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.055em] sm:text-5xl">
            No dejes pasar la próxima oportunidad.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Dinos dónde podemos contactarte y recibe las nuevas ofertas sanitarias
            en cuanto se publiquen.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              [MailCheck, "Directo al email", "Sin tener que visitar varias webs."],
              [CheckCircle2, "Ofertas relevantes", "Solo oportunidades del ámbito sanitario."],
              [ShieldCheck, "Control total", "Cancela cuando quieras."],
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
            Crear mi alerta
          </h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-muted">
            Elige comunidad, profesión o sector (opcional) y confirma el email
            para activarla. Puedes cambiarla o cancelarla en cualquier momento.
          </p>
          <AlertForm />
        </aside>
      </main>
      <Footer />
    </>
  );
}
