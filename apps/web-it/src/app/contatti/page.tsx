import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LegalOwnerList } from "@/components/legal-owner";
import { LEGAL_OWNER } from "@/lib/legal";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Contatta ${SITE_NAME}: segnalazioni su offerte e concorsi, richieste sui dati personali, collaborazioni e comunicazioni di enti ed editori.`;

export const metadata: Metadata = {
  title: "Contatti",
  description: DESCRIPTION,
  alternates: { canonical: "/contatti" },
  openGraph: {
    title: `Contatti | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/contatti",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Contatti</p>
          <h1>Contatti</h1>
          <p>
            Per qualsiasi richiesta su {SITE_NAME} puoi scriverci
            all&apos;indirizzo{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
            Cerchiamo di rispondere il prima possibile.
          </p>

          <h2>Di cosa possiamo occuparci</h2>
          <ul>
            <li>
              <strong>Segnalazioni su un&apos;offerta o un concorso:</strong>{" "}
              annuncio scaduto, dati errati o contenuto da rimuovere. Indica
              sempre il link della pagina.
            </li>
            <li>
              <strong>Dati personali:</strong> esercizio dei diritti previsti
              dal GDPR (accesso, rettifica, cancellazione, opposizione). Vedi
              l&apos;<Link href="/privacy">informativa sulla privacy</Link>.
            </li>
            <li>
              <strong>Avvisi di lavoro:</strong> per annullare l&apos;iscrizione
              usa il link presente in ogni email o la pagina di gestione
              dell&apos;avviso.
            </li>
            <li>
              <strong>Enti, aziende ed editori:</strong> richieste di
              correzione o di collaborazione.
            </li>
          </ul>
          <p>
            {SITE_NAME} non è un&apos;agenzia per il lavoro: non riceviamo
            curriculum né candidature. Per candidarti usa il link
            all&apos;annuncio originale.
          </p>

          <h2>Titolare del sito</h2>
          <LegalOwnerList />
          <p>
            Maggiori dettagli nelle <Link href="/note-legali">note legali</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
