import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ScoreCalculator } from "@/components/score-calculator";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

const PATH = "/strumenti/calcolo-punteggio-concorso";
const title = "Calcolo punteggio titoli concorso sanità: calcolatore DPR 220/2001";
const description =
  "Calcola una stima del punteggio titoli nei concorsi per infermieri, OSS e altri profili del comparto sanità: servizio SSN e privato, titoli di studio, pubblicazioni e curriculum, con le regole del DPR 220/2001.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PATH },
  openGraph: { title, description, url: PATH, type: "website", siteName: SITE_NAME, locale: "it_IT" },
  twitter: { card: "summary_large_image", title, description },
};

const NORMATTIVA = "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:2001-02-27;220";
const GU = "https://www.gazzettaufficiale.it/eli/id/2001/06/12/001G0262/sg";

const faq = [
  {
    q: "Quanti punti valgono i titoli in un concorso della sanità?",
    a: "Nei concorsi per titoli ed esami del comparto sanità i titoli valgono 30 punti su 100 e le prove d'esame 70 (scritta 30, pratica 20, orale 20). Se le prove sono due, i titoli valgono 40 punti e le prove 60 (30 pratica, 30 orale). Lo stabilisce l'art. 8, commi 3 e 4, del DPR 220/2001.",
  },
  {
    q: "Come si divide il punteggio fra le categorie di titoli?",
    a: "I titoli si ripartiscono in quattro categorie: titoli di carriera, titoli accademici e di studio, pubblicazioni e titoli scientifici, curriculum formativo e professionale. Il DPR 220/2001 non fissa il massimo di ciascuna: la ripartizione è stabilita dal bando di concorso (art. 8, comma 3).",
  },
  {
    q: "Come si calcola il servizio prestato?",
    a: "Il servizio è valutato a mesi: contano come mese intero i periodi continuativi di 30 giorni o le frazioni superiori a 15 giorni. I servizi omogenei si sommano, quelli contemporanei contano una sola volta (il più favorevole) e il tempo parziale è proporzionato all'orario (art. 11, comma 1, lett. a). Il servizio a tempo determinato nelle pubbliche amministrazioni è equiparato a quello a tempo indeterminato (art. 20, comma 1).",
  },
  {
    q: "Il servizio in una struttura privata conta?",
    a: "Dipende dalla struttura. Il servizio presso istituti ed enti equiparati ai sensi dell'art. 21, comma 1, vale come servizio presso le aziende sanitarie; quello in case di cura convenzionate o accreditate, con rapporto continuativo, è valutato per il 25% della durata (art. 21, comma 3). Verifica nel bando se e come viene valutato il privato.",
  },
  {
    q: "Il servizio da OSS conta per un concorso da infermiere?",
    a: "Il servizio in una categoria inferiore o in qualifiche corrispondenti è valutato con un punteggio non superiore al 50% di quello reso nel profilo a concorso (art. 11, comma 1, lett. a, n. 1). Il bando indica la percentuale esatta.",
  },
  {
    q: "Il punteggio calcolato qui è quello ufficiale?",
    a: "No: è una stima. I punti per anno di servizio, i massimi per categoria e i punteggi dei titoli accademici cambiano da bando a bando, e la commissione attribuisce con giudizio motivato il punteggio di titoli di studio, pubblicazioni e curriculum. Usa il calcolatore per orientarti e controlla sempre i criteri del tuo bando.",
  },
  {
    q: "Il DPR 220/2001 vale anche per gli OSS?",
    a: "Il DPR 220/2001 disciplina i concorsi del personale non dirigenziale del Servizio sanitario nazionale. L'OSS non è citato espressamente: per la categoria B l'art. 24 prevede la selezione pubblica, e il bando di ogni azienda indica le regole e i criteri di valutazione applicati. Leggi sempre il bando.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calcolo punteggio titoli concorso sanità",
    url: absoluteUrl(PATH),
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    inLanguage: "it-IT",
    isAccessibleForFree: true,
    description,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  },
];

const serviceRows = [
  ["Profilo a concorso, SSN o altra PA", "100% (a tempo determinato equiparato all'indeterminato)", "art. 11, c. 1, lett. a; art. 20, c. 1"],
  ["Categoria inferiore o qualifica corrispondente", "non oltre il 50%", "art. 11, c. 1, lett. a, n. 1"],
  ["Casa di cura convenzionata o accreditata", "25% della durata", "art. 21, c. 3"],
  ["Enti ed istituti equiparati (art. 21, c. 1)", "come servizio presso le aziende sanitarie", "art. 21, c. 1"],
  ["Servizio all'estero riconosciuto (UE)", "come servizio di ruolo, se riconosciuto", "art. 22"],
];

export default function ScoreCalculatorPage() {
  const link = "font-semibold text-primary hover:underline";
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Strumenti" }, { label: "Calcolo punteggio concorso" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Calcolo del punteggio titoli nei concorsi della sanità
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Stima quanti punti di titoli puoi ottenere in un concorso per infermieri, OSS e altri profili del comparto sanità, a
              partire dai mesi di servizio, dai titoli di studio, dalle pubblicazioni e dal curriculum. Le regole sono quelle del DPR 220/2001;
              i valori che cambiano da bando a bando li puoi modificare.
            </p>
          </div>
        </section>

        <div className="page-container space-y-12 py-10">
          <ScoreCalculator />

          <section className="max-w-3xl space-y-4 text-sm leading-7 sm:text-base">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">
              Come si calcola il punteggio titoli nei concorsi per infermieri e OSS
            </h2>
            <p>
              Nei concorsi pubblici per titoli ed esami del personale non dirigenziale del Servizio sanitario nazionale, la graduatoria nasce
              dalla somma di due parti: i punti dei titoli e i punti delle prove. L&apos;art. 8 del{" "}
              <a className={link} href={NORMATTIVA} target="_blank" rel="noopener">
                DPR 27 febbraio 2001, n. 220
              </a>{" "}
              fissa il totale in 100 punti: 30 ai titoli e 70 alle prove (scritta, pratica, orale), oppure 40 ai titoli e 60 alle prove se gli esami sono
              due. Il voto finale è la somma del punteggio dei titoli e di quello delle prove (art. 8, comma 5).
            </p>
            <h3 className="text-lg font-extrabold">Le quattro categorie di titoli</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Titoli di carriera</strong>: il servizio reso presso ASL, aziende ospedaliere, enti equiparati e altre pubbliche amministrazioni
                nel profilo a concorso o in qualifiche corrispondenti. Si valuta a mesi (mese intero per 30 giorni continuativi o frazioni oltre 15 giorni);
                il tempo parziale è proporzionato; con servizi contemporanei conta il più favorevole (art. 11, comma 1, lett. a).
              </li>
              <li>
                <strong>Titoli accademici e di studio</strong>: valutati dalla commissione con motivazione, in base all&apos;attinenza con il profilo
                (art. 11, comma 1, lett. b). Il titolo richiesto per l&apos;ammissione non è oggetto di valutazione.
              </li>
              <li>
                <strong>Pubblicazioni e titoli scientifici</strong>: contano originalità, importanza della rivista, continuità, attinenza e numero di autori
                (art. 11, comma 1, lett. c).
              </li>
              <li>
                <strong>Curriculum formativo e professionale</strong>: attività professionali e di studio documentate e non già valutate, corsi di
                formazione e aggiornamento qualificati per durata ed esame finale, incarichi di docenza; punteggio globale e motivato.
              </li>
            </ul>
            <h3 className="text-lg font-extrabold">Servizio: ruolo, tempo determinato, categoria inferiore, privato</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="border-b border-border py-2 pr-3">Servizio</th>
                    <th className="border-b border-border py-2 pr-3">Valutazione</th>
                    <th className="border-b border-border py-2">Riferimento</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map(([a, b, c]) => (
                    <tr key={a}>
                      <td className="border-b border-border py-2.5 pr-3 font-semibold">{a}</td>
                      <td className="border-b border-border py-2.5 pr-3">{b}</td>
                      <td className="border-b border-border py-2.5 text-muted">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <strong>Cosa decide il bando.</strong> Il DPR non indica quanti punti vale un anno di servizio né il massimo di ogni categoria: la ripartizione dei
              punti fra le categorie «è stabilita in sede di bando di concorso» (art. 8, comma 3) e i criteri di massima li fissa la commissione prima delle
              prove. Per questo il calcolatore ti lascia modificare ogni coefficiente: copia i valori dal tuo bando e avrai una stima molto più vicina al
              risultato reale. I titoli vengono valutati solo per i candidati presenti alla prova scritta e il risultato è reso noto prima dell&apos;orale
              (art. 8, comma 1).
            </p>
            <p>
              Per approfondire la procedura, leggi{" "}
              <Link className={link} href="/notizie/come-funzionano-concorsi-pubblici-sanita">
                come funzionano i concorsi pubblici nella sanità
              </Link>{" "}
              e{" "}
              <Link className={link} href="/notizie/come-leggere-bando-concorso-sanita">
                come leggere un bando
              </Link>
              . Poi guarda i bandi aperti:{" "}
              <Link className={link} href="/concorsi-infermieri-2026">
                concorsi infermieri
              </Link>
              ,{" "}
              <Link className={link} href="/concorsi-oss-2026">
                concorsi OSS
              </Link>
              ,{" "}
              <Link className={link} href="/concorsi/calendario">
                calendario delle scadenze
              </Link>
              .
            </p>
          </section>

          <section className="max-w-3xl">
            <h2 className="text-xl font-extrabold">Domande frequenti</h2>
            <div className="mt-4 space-y-5">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-3xl text-sm leading-7 text-muted">
            <h2 className="text-base font-extrabold text-foreground">Fonti normative</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <a className="text-primary hover:underline" href={NORMATTIVA} target="_blank" rel="noopener">
                  DPR 27 febbraio 2001, n. 220 (Normattiva)
                </a>
                : Regolamento recante disciplina concorsuale del personale non dirigenziale del Servizio sanitario nazionale. Artt. 8 (concorso per
                titoli ed esami, ripartizione 30/70 e 40/60), 11 (criteri di valutazione dei titoli), 20 (equiparazione dei servizi non di ruolo), 21
                (servizi e titoli equiparabili, case di cura convenzionate), 22 (servizio all&apos;estero).
              </li>
              <li>
                <a className="text-primary hover:underline" href={GU} target="_blank" rel="noopener">
                  Gazzetta Ufficiale n. 134 del 12 giugno 2001, Suppl. Ordinario n. 144
                </a>
                .
              </li>
            </ul>
            <p className="mt-3">Testo consultato su Normattiva il 20 novembre 2026. Verifica sempre la versione vigente e il bando del concorso.</p>
          </section>
        </div>
      </main>
      <Footer />
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      ))}
    </>
  );
}
