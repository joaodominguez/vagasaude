import type { Metadata } from "next";
import { BellRing, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Crea un avviso di lavoro",
  description:
    "Ricevi via email le nuove offerte e i nuovi concorsi della sanità che corrispondono ai tuoi interessi.",
  alternates: { canonical: "/avvisi" },
  openGraph: {
    title: `Crea un avviso di lavoro | ${SITE_NAME}`,
    description:
      "Ricevi via email le nuove offerte e i nuovi concorsi della sanità che corrispondono ai tuoi interessi.",
    url: "/avvisi",
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
            Avvisi gratuiti
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.055em] sm:text-5xl">
            Non lasciarti sfuggire la prossima opportunità.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Indicaci dove scriverti e ricevi le nuove offerte sanitarie non
            appena vengono pubblicate.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              [MailCheck, "Direttamente via email", "Senza dover visitare più siti."],
              [CheckCircle2, "Offerte pertinenti", "Solo opportunità del settore sanitario."],
              [ShieldCheck, "Pieno controllo", "Annulli quando vuoi."],
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
            Crea il mio avviso
          </h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-muted">
            Scegli regione, professione o settore (facoltativi) e conferma
            l&apos;email per attivarlo. Puoi modificarlo o annullarlo in
            qualsiasi momento.
          </p>
          <AlertForm />
        </aside>
      </main>
      <Footer />
    </>
  );
}
