import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Come ${SITE_NAME} raccoglie offerte di lavoro e concorsi nella sanità, come funzionano gli avvisi e dove ti candidi.`;

export const metadata: Metadata = {
  title: "Come funziona",
  description: DESCRIPTION,
  alternates: { canonical: "/come-funziona" },
  openGraph: {
    title: `Come funziona | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/come-funziona",
    type: "website",
  },
};

const FAQ = [
  {
    q: `${SITE_NAME} è un sito di selezione del personale?`,
    a: "No. Siamo un aggregatore: raccogliamo offerte e concorsi del settore sanitario pubblicati da aziende sanitarie, ospedali, strutture private e accreditate ed enti pubblici. La candidatura si fa sempre sul sito ufficiale dell'ente.",
  },
  {
    q: "Come mi candido a un'offerta?",
    a: `Apri l'offerta su ${SITE_NAME}, controlla i dettagli e usa il pulsante di candidatura. Ti portiamo alla pagina dell'ente o dell'azienda che ha pubblicato l'annuncio: non inviamo curriculum e non gestiamo domande di partecipazione.`,
  },
  {
    q: "Da dove arrivano le offerte?",
    a: "Da fonti pubbliche (bandi di concorso, avvisi e graduatorie delle aziende sanitarie) e dai siti di lavoro di strutture sanitarie (ospedali, cliniche, RSA e gruppi privati). Aggiorniamo le fonti con regolarità e rimuoviamo gli annunci scaduti.",
  },
  {
    q: "Come funzionano gli avvisi?",
    a: "Scegli i filtri (regione, professione, settore), confermi l'indirizzo email e ricevi una comunicazione quando compare una nuova offerta che corrisponde. Puoi modificare o annullare l'avviso in qualsiasi momento dall'email.",
  },
  {
    q: "Perché vedo solo offerte del settore sanitario?",
    a: "È la specializzazione del servizio: infermieristica, medicina, OSS, tecnici sanitari e le funzioni dell'ecosistema sanitario (formazione, gestione, amministrazione). Così la ricerca è più rapida e con meno rumore.",
  },
  {
    q: "I dati sono corretti?",
    a: "Facciamo il possibile per normalizzare titolo, sede e professione, ma fa fede la fonte ufficiale. Se trovi un errore, il bando o l'annuncio originale dell'ente è il riferimento, soprattutto per scadenze e requisiti dei concorsi.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page mx-auto max-w-3xl">
          <p className="section-kicker">Trasparenza</p>
          <h1>Come funziona</h1>
          <p>
            {SITE_NAME} esiste per far risparmiare tempo a chi cerca lavoro
            nella sanità in Italia: un sito semplice, aggiornato e con filtri
            che hanno senso per il settore.
          </p>

          <h2>In 3 passaggi</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[0.98rem] leading-7 text-muted">
            <li>
              <strong className="text-foreground">Cerca</strong> per
              professione, regione o parola chiave.
            </li>
            <li>
              <strong className="text-foreground">Consulta</strong> l&apos;annuncio
              e verifica sede, settore e requisiti.
            </li>
            <li>
              <strong className="text-foreground">Candidati</strong> sul sito
              dell&apos;ente: noi facciamo solo da ponte.
            </li>
          </ol>

          <h2>Domande frequenti</h2>
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
            <Link href="/offerte" className="button button-primary">
              Vedi le offerte
            </Link>
            <Link href="/avvisi" className="button button-secondary">
              Crea un avviso
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
