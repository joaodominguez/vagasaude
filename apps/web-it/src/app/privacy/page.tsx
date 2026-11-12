import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LegalOwnerList } from "@/components/legal-owner";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_OWNER,
  LOG_RETENTION,
} from "@/lib/legal";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Informativa sulla privacy di ${SITE_NAME}: titolare del trattamento, finalità, base giuridica, destinatari, tempi di conservazione e diritti degli interessati (GDPR).`;

const GA_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const CLARITY_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID);
const ANALYTICS_ENABLED = GA_ENABLED || CLARITY_ENABLED;

export const metadata: Metadata = {
  title: "Informativa sulla privacy",
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Informativa sulla privacy | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/privacy",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Trasparenza</p>
          <h1>Informativa sulla privacy</h1>
          <p>
            Ultimo aggiornamento: {LEGAL_LAST_UPDATED}. Informativa resa ai
            sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) e
            del D.Lgs. 196/2003 (Codice in materia di protezione dei dati
            personali), come modificato dal D.Lgs. 101/2018.
          </p>

          <h2>1. Titolare del trattamento</h2>
          <LegalOwnerList />
          <p>
            Per qualsiasi questione relativa ai tuoi dati scrivi a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
          </p>

          <h2>2. Quali dati trattiamo, perché e su quale base giuridica</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Finalità</th>
                  <th>Dati</th>
                  <th>Base giuridica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Avvisi di lavoro via email: confermare l&apos;iscrizione e
                    inviarti le offerte che corrispondono ai filtri scelti.
                  </td>
                  <td>
                    Indirizzo email, filtri scelti (regione, professione,
                    settore), date di iscrizione, conferma e cancellazione,
                    token di gestione.
                  </td>
                  <td>
                    Consenso (art. 6, par. 1, lett. a GDPR), con doppia
                    conferma (double opt-in).
                  </td>
                </tr>
                {ANALYTICS_ENABLED ? (
                  <tr>
                    <td>
                      Analisi statistica dell&apos;uso del Sito per
                      migliorarlo
                      {GA_ENABLED ? " (Google Analytics)" : ""}
                      {CLARITY_ENABLED ? " (Microsoft Clarity)" : ""}.
                    </td>
                    <td>
                      Identificatori nei cookie, pagine visitate, interazioni,
                      dispositivo e browser, posizione approssimativa.
                    </td>
                    <td>
                      Consenso (art. 6, par. 1, lett. a GDPR), prestato tramite
                      il banner cookie. Gli strumenti si attivano solo dopo
                      l&apos;accettazione e il consenso può essere revocato in
                      ogni momento da «Impostazioni cookie».
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td>
                    Sicurezza e funzionamento del server: log di accesso,
                    prevenzione di abusi e frodi.
                  </td>
                  <td>
                    Indirizzo IP, data e ora, URL richiesto, user agent.
                  </td>
                  <td>
                    Legittimo interesse (art. 6, par. 1, lett. f GDPR) alla
                    sicurezza del servizio.
                  </td>
                </tr>
                <tr>
                  <td>Rispondere alle tue richieste e all&apos;esercizio dei diritti.</td>
                  <td>Indirizzo email e contenuto del messaggio.</td>
                  <td>
                    Esecuzione di misure precontrattuali su tua richiesta e
                    adempimento di obblighi di legge (art. 6, par. 1, lett. b e
                    c GDPR).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Statistiche proprie:</strong> raccogliamo inoltre
            statistiche di utilizzo anonime e aggregate, senza cookie e senza
            memorizzare nulla sul tuo dispositivo. Non vengono conservati
            indirizzi IP. Questi dati servono solo a migliorare il servizio.
          </p>
          <p>
            <strong>Preferiti:</strong> sono salvati solo nella memoria locale
            del tuo browser e non vengono inviati ai nostri server.{" "}
            <strong>Candidature:</strong> avvengono sui siti degli enti e delle
            aziende che pubblicano gli annunci; {SITE_NAME} non riceve né
            conserva curriculum. Quando esci verso quei siti si applicano le
            loro informative.
          </p>
          <p>
            Non adottiamo decisioni automatizzate che producano effetti
            giuridici nei tuoi confronti né effettuiamo profilazione diversa dal
            filtro delle offerte che configuri tu. Non trattiamo categorie
            particolari di dati. Il servizio non è rivolto a minori di 14 anni.
            Il conferimento dei dati per gli avvisi è facoltativo, ma senza
            indirizzo email non possiamo inviarli.
          </p>

          <h2>3. Destinatari e responsabili del trattamento</h2>
          <p>
            Non vendiamo i tuoi dati. Li comunichiamo solo a fornitori che
            agiscono come responsabili del trattamento o a soggetti necessari
            all&apos;erogazione del servizio, e alle autorità quando la legge lo
            richiede:
          </p>
          <ul>
            <li>
              <strong>Hetzner Online GmbH (Germania, UE):</strong> hosting del
              server in cui sono conservati i dati degli avvisi e i log.
            </li>
            <li>
              <strong>Resend (Stati Uniti):</strong> invio delle email
              transazionali e degli avvisi. Trasferimento extra-UE basato sul
              EU-U.S. Data Privacy Framework e/o sulle clausole contrattuali
              tipo della Commissione europea.
            </li>
            {GA_ENABLED ? (
              <li>
                <strong>Google (Google Analytics):</strong> analisi statistica,
                solo con il tuo consenso. Può comportare trasferimenti verso
                gli Stati Uniti con le garanzie sopra indicate.
              </li>
            ) : null}
            {CLARITY_ENABLED ? (
              <li>
                <strong>Microsoft (Clarity):</strong> mappe di calore e
                registrazione delle sessioni, solo con il tuo consenso. Può
                comportare trasferimenti verso gli Stati Uniti con le stesse
                garanzie.
              </li>
            ) : null}
          </ul>
          <p>
            Maggiori dettagli su cookie e terze parti nella{" "}
            <Link href="/cookie">cookie policy</Link>.
          </p>

          <h2>4. Tempi di conservazione</h2>
          <ul>
            <li>
              <strong>Avvisi:</strong> finché mantieni l&apos;iscrizione. Se
              annulli l&apos;iscrizione conserviamo il minimo indispensabile
              (in forma bloccata) per gestire eventuali contestazioni nei
              termini di prescrizione e per non riscriverti; poi i dati
              vengono cancellati. Le iscrizioni non confermate vengono
              eliminate dopo un congruo periodo.
            </li>
            {ANALYTICS_ENABLED ? (
              <li>
                <strong>Analytics:</strong> fino alla revoca del consenso o alla
                scadenza dei cookie (vedi cookie policy); i dati presso gli
                strumenti di terzi sono conservati secondo le impostazioni di
                retention di ciascuno.
              </li>
            ) : null}
            <li>
              <strong>Log del server:</strong> {LOG_RETENTION}.
            </li>
            <li>
              <strong>Richieste:</strong> il tempo necessario a gestirle e,
              successivamente, per i termini di prescrizione previsti dalla
              legge.
            </li>
          </ul>

          <h2>5. I tuoi diritti</h2>
          <p>
            Puoi esercitare i diritti di accesso, rettifica, cancellazione,
            limitazione del trattamento, portabilità e opposizione (artt.
            15-22 GDPR) e revocare il consenso in qualsiasi momento, senza
            pregiudicare la liceità del trattamento precedente, scrivendo a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a> e
            indicando il diritto che intendi esercitare. Potremmo chiederti di
            verificare la tua identità. Risponderemo entro un mese.
          </p>
          <ul>
            <li>
              Per annullare l&apos;iscrizione agli avvisi usa il link presente
              in ogni email o la pagina di gestione dell&apos;avviso.
            </li>
            <li>
              Per modificare il consenso ai cookie usa «Impostazioni cookie»
              nel piè di pagina.
            </li>
          </ul>

          <h2>6. Reclami</h2>
          <p>
            Se ritieni che i tuoi dati non siano trattati correttamente puoi
            proporre reclamo al Garante per la protezione dei dati personali:{" "}
            <a
              href="https://www.garanteprivacy.it"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.garanteprivacy.it
            </a>
            .
          </p>

          <h2>7. Sicurezza</h2>
          <p>
            Adottiamo misure tecniche e organizzative ragionevoli: connessioni
            cifrate (HTTPS), accesso limitato ai dati e all&apos;area di
            amministrazione, token univoci per la gestione degli avvisi.
          </p>

          <h2>8. Modifiche a questa informativa</h2>
          <p>
            Possiamo aggiornare questa informativa per riflettere cambiamenti
            normativi o del servizio. Qui pubblichiamo sempre la versione
            vigente con la relativa data.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
