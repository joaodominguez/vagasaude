import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LegalOwnerList } from "@/components/legal-owner";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const DESCRIPTION = `Note legali di ${SITE_NAME}: titolare del sito, condizioni d'uso, proprietà intellettuale, limitazioni di responsabilità e legge applicabile.`;

export const metadata: Metadata = {
  title: "Note legali",
  description: DESCRIPTION,
  alternates: { canonical: "/note-legali" },
  openGraph: {
    title: `Note legali | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/note-legali",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function LegalNoticePage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Informazioni legali</p>
          <h1>Note legali</h1>
          <p>Ultimo aggiornamento: {LEGAL_LAST_UPDATED}.</p>

          <h2>1. Titolare del sito</h2>
          <p>
            Ai sensi dell&apos;art. 7 del D.Lgs. 70/2003 (attuazione della
            direttiva 2000/31/CE sul commercio elettronico), si informa che il
            sito {SITE_URL.replace("https://", "")} (di seguito, «il Sito») è
            gestito da:
          </p>
          <LegalOwnerList />

          <h2>2. Natura del servizio</h2>
          <p>
            {SITE_NAME} è un aggregatore di offerte di lavoro e di concorsi nel
            settore sanitario in Italia. Raccogliamo e organizziamo annunci
            pubblicati da terzi (aziende sanitarie, ospedali, strutture
            private e accreditate, enti pubblici e altre fonti) per renderne
            più semplice la consultazione.
          </p>
          <ul>
            <li>
              Le offerte appartengono ai rispettivi editori, che sono gli unici
              responsabili di contenuto, veridicità e validità degli annunci.
            </li>
            <li>
              {SITE_NAME} non è un&apos;agenzia per il lavoro né una società di
              selezione del personale, non partecipa alle procedure di
              selezione e non garantisce l&apos;ottenimento di un impiego.
            </li>
            <li>
              La candidatura avviene sempre sul sito dell&apos;ente o
              dell&apos;azienda che ha pubblicato l&apos;annuncio. Il Sito non
              riceve, non conserva e non gestisce curriculum.
            </li>
            <li>
              Pur aggiornando le fonti con regolarità, un&apos;offerta può
              essere scaduta o aver cambiato condizioni: verifica sempre il
              bando o l&apos;annuncio originale, in particolare le scadenze dei
              concorsi.
            </li>
          </ul>

          <h2>3. Condizioni d&apos;uso</h2>
          <p>
            L&apos;accesso e l&apos;uso del Sito sono gratuiti. Utilizzando il
            Sito accetti di farlo nel rispetto della legge, della buona fede e
            delle presenti note legali. È vietato:
          </p>
          <ul>
            <li>
              usare il Sito per scopi illeciti o lesivi dei diritti di terzi;
            </li>
            <li>
              estrarre in modo massivo o automatizzato i contenuti (scraping),
              riprodurli o riutilizzarli a fini commerciali senza previa
              autorizzazione scritta;
            </li>
            <li>
              introdurre virus o compiere azioni che danneggino, sovraccarichino
              o compromettano il funzionamento del Sito;
            </li>
            <li>
              iscrivere indirizzi email di terzi agli avvisi senza il loro
              consenso.
            </li>
          </ul>

          <h2>4. Proprietà intellettuale e industriale</h2>
          <p>
            Grafica, codice, struttura, testi originali, loghi e marchio di{" "}
            {SITE_NAME} sono di titolarità del gestore del Sito o utilizzati su
            licenza e sono tutelati dalla normativa su diritto d&apos;autore e
            proprietà industriale. Marchi, loghi e contenuti degli enti e delle
            aziende che pubblicano le offerte appartengono ai rispettivi
            titolari e sono mostrati a solo scopo informativo e di rinvio
            all&apos;annuncio originale. Se sei titolare di diritti e ritieni
            che un contenuto li violi, scrivici all&apos;indirizzo indicato
            sopra: valuteremo la segnalazione con tempestività.
          </p>

          <h2>5. Limitazione di responsabilità</h2>
          <ul>
            <li>
              Non garantiamo la disponibilità continua del Sito né l&apos;assenza
              di errori, e possiamo sospenderlo o modificarlo senza preavviso.
            </li>
            <li>
              Non rispondiamo dell&apos;esattezza, dell&apos;aggiornamento o
              della liceità delle offerte di terzi, né dei danni derivanti dal
              loro utilizzo o dalle procedure di selezione.
            </li>
            <li>
              Il Sito contiene link a siti di terzi sui cui contenuti e
              politiche non abbiamo alcun controllo e di cui non ci assumiamo
              responsabilità.
            </li>
          </ul>

          <h2>6. Protezione dei dati e cookie</h2>
          <p>
            Il trattamento dei dati personali è descritto
            nell&apos;<Link href="/privacy">informativa sulla privacy</Link> e
            l&apos;uso dei cookie nella <Link href="/cookie">cookie policy</Link>.
          </p>

          <h2>7. Legge applicabile e foro competente</h2>
          <p>
            Le presenti note legali sono regolate dalla legge italiana. Per
            qualsiasi controversia è competente il foro determinato secondo le
            norme applicabili; se l&apos;utente riveste la qualifica di
            consumatore, resta ferma la competenza inderogabile del foro del
            luogo di residenza o di domicilio. Per richieste o reclami puoi
            scriverci all&apos;indirizzo indicato al punto 1 o consultare la
            pagina <Link href="/contatti">Contatti</Link>.
          </p>

          <h2>8. Modifiche</h2>
          <p>
            Possiamo aggiornare queste note legali per adeguarle a cambiamenti
            normativi o del servizio. Fa fede la versione pubblicata in questa
            pagina.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
