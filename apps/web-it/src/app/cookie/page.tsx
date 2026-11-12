import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { Header } from "@/components/header";
import { LEGAL_LAST_UPDATED, LEGAL_OWNER } from "@/lib/legal";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Cookie policy di ${SITE_NAME}: quali cookie e archiviazione locale usiamo, a cosa servono, quanto durano e come modificare il consenso.`;

const GA_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const CLARITY_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID);
const ANALYTICS_ENABLED = GA_ENABLED || CLARITY_ENABLED;

export const metadata: Metadata = {
  title: "Cookie policy",
  description: DESCRIPTION,
  alternates: { canonical: "/cookie" },
  openGraph: {
    title: `Cookie policy | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/cookie",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Trasparenza</p>
          <h1>Cookie policy</h1>
          <p>Ultimo aggiornamento: {LEGAL_LAST_UPDATED}.</p>

          <h2>1. Cosa sono i cookie</h2>
          <p>
            I cookie sono piccoli file che un sito salva sul tuo dispositivo.
            Questa policy riguarda anche tecnologie analoghe, come la memoria
            locale del browser (localStorage). Come previsto dalle Linee guida
            cookie e altri strumenti di tracciamento del Garante per la
            protezione dei dati personali (10 giugno 2021), i cookie tecnici
            possono essere usati senza consenso, mentre quelli di analisi non
            anonimizzati e quelli di profilazione richiedono il tuo consenso
            preventivo.
          </p>

          <h2>2. Titolare</h2>
          <p>
            {LEGAL_OWNER.name} (P.IVA / codice fiscale / NIF {LEGAL_OWNER.taxId}),
            contatto{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
            Vedi le <Link href="/note-legali">note legali</Link> e
            l&apos;<Link href="/privacy">informativa sulla privacy</Link>.
          </p>

          <h2>3. Cookie tecnici necessari (senza consenso)</h2>
          <p>
            Indispensabili al funzionamento del Sito o a ricordare le tue
            preferenze. Non sono usati per pubblicità né per analisi
            statistica.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Finalità</th>
                  <th>Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>os_consent</td>
                  <td>Cookie di prima parte</td>
                  <td>
                    Salva la tua scelta sui cookie (versione e data) per non
                    ripetere la richiesta.
                  </td>
                  <td>13 mesi</td>
                </tr>
                <tr>
                  <td>offertesanita-theme</td>
                  <td>localStorage di prima parte</td>
                  <td>Ricorda il tema chiaro/scuro scelto.</td>
                  <td>Fino alla cancellazione</td>
                </tr>
                <tr>
                  <td>Preferiti</td>
                  <td>localStorage di prima parte</td>
                  <td>
                    Salva nel tuo browser le offerte che contrassegni come
                    preferite. Non vengono inviate ai nostri server.
                  </td>
                  <td>Fino alla cancellazione</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            L&apos;area di amministrazione (riservata al titolare) usa
            l&apos;autenticazione HTTP di base del browser e non installa cookie
            di sessione per i visitatori.
          </p>
          <p>
            Misuriamo inoltre l&apos;uso del Sito con statistiche proprie,
            anonime e aggregate, che non usano cookie né memorizzano nulla sul
            tuo dispositivo. Non vengono conservati indirizzi IP e i dati
            servono solo a migliorare il servizio.
          </p>

          <h2>4. Cookie di analisi (solo con consenso)</h2>
          {ANALYTICS_ENABLED ? (
            <>
              <p>
                Ci permettono di misurare l&apos;uso del Sito e di migliorarlo.
                Sono disattivati finché non li accetti dal banner o da
                «Impostazioni cookie» (sezione 6): prima del tuo consenso non
                viene caricato alcuno script di terze parti. Non usiamo cookie
                pubblicitari né di profilazione.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Fornitore</th>
                      <th>Finalità</th>
                      <th>Durata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GA_ENABLED ? (
                      <>
                        <tr>
                          <td>_ga</td>
                          <td>Google Analytics 4 (Google Ireland Ltd.)</td>
                          <td>
                            Distingue gli utenti in forma pseudonima per le
                            statistiche.
                          </td>
                          <td>2 anni</td>
                        </tr>
                        <tr>
                          <td>_ga_&lt;ID&gt;</td>
                          <td>Google Analytics 4</td>
                          <td>Mantiene lo stato della sessione.</td>
                          <td>2 anni</td>
                        </tr>
                      </>
                    ) : null}
                    {CLARITY_ENABLED ? (
                      <>
                        <tr>
                          <td>_clck</td>
                          <td>Microsoft Clarity (Microsoft Corp.)</td>
                          <td>
                            Memorizza l&apos;identificativo di utente e sessione
                            di Clarity.
                          </td>
                          <td>1 anno</td>
                        </tr>
                        <tr>
                          <td>_clsk</td>
                          <td>Microsoft Clarity</td>
                          <td>Raggruppa le pagine viste in un&apos;unica sessione.</td>
                          <td>1 giorno</td>
                        </tr>
                        <tr>
                          <td>CLID, ANONCHK, MR, SM</td>
                          <td>Microsoft Clarity / Bing</td>
                          <td>
                            Identificazione del client, verifica
                            dell&apos;anonimato, rinnovo e sincronizzazione.
                          </td>
                          <td>Da sessione a 1 anno</td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p>
                Le durate sono quelle dichiarate dai fornitori e possono
                cambiare. Non utilizziamo cookie pubblicitari né di
                personalizzazione degli annunci (ad_storage, ad_user_data e
                ad_personalization restano sempre negati in Google Consent
                Mode).
              </p>
            </>
          ) : (
            <p>
              Al momento non sono attivi strumenti di analisi di terze parti e
              non viene installato alcun cookie di analisi. Se in futuro li
              attiveremo, questa pagina verrà aggiornata e ti chiederemo il
              consenso prima di installare qualsiasi cookie.
            </p>
          )}

          {ANALYTICS_ENABLED ? (
            <>
              <h2>5. Terze parti e trasferimenti extra-UE</h2>
              <p>
                {GA_ENABLED ? "Google (Google Analytics)" : ""}
                {GA_ENABLED && CLARITY_ENABLED ? " e " : ""}
                {CLARITY_ENABLED ? "Microsoft (Clarity)" : ""} possono trattare
                dati negli Stati Uniti o in altri Paesi fuori dallo Spazio
                economico europeo. Tali trasferimenti si basano sulla decisione
                di adeguatezza del EU-U.S. Data Privacy Framework (se il
                fornitore è certificato) e/o sulle clausole contrattuali tipo
                della Commissione europea. Accettando i cookie di analisi
                acconsenti anche a questi trasferimenti. Maggiori informazioni
                nelle informative di{" "}
                <a
                  href="https://policies.google.com/privacy?hl=it"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google
                </a>{" "}
                e di{" "}
                <a
                  href="https://privacy.microsoft.com/it-it/privacystatement"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Microsoft
                </a>
                .
              </p>
            </>
          ) : null}

          <h2>6. Come gestire o revocare il consenso</h2>
          <p>
            Puoi accettare, rifiutare o modificare la tua scelta in qualsiasi
            momento: <CookieSettingsButton className="link-button" />. Se
            revochi il consenso eliminiamo i cookie di analisi e smettiamo di
            caricare gli strumenti di terze parti; la tua scelta viene
            conservata per 13 mesi.
          </p>
          <p>
            Puoi inoltre bloccare o eliminare i cookie dalle impostazioni del
            tuo browser (Chrome, Firefox, Safari, Edge), tenendo presente che
            alcune funzioni del Sito potrebbero non funzionare.
          </p>

          <h2>7. Maggiori informazioni</h2>
          <p>
            Linee guida del Garante sui cookie:{" "}
            <a
              href="https://www.garanteprivacy.it"
              target="_blank"
              rel="noopener noreferrer"
            >
              garanteprivacy.it
            </a>
            . In caso di dubbi scrivici a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
