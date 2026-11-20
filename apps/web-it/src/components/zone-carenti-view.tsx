import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import {
  LAZIO,
  REGIONI,
  TIPO_LABEL,
  TIPO_SHORT,
  TIPO_UNIT,
  ZC_HUB_PATH,
  currentPublications,
  earlierPublications,
  formatDate,
  int,
  isOpen,
  officialTotal,
  regionLastmod,
  regionTotals,
  statusLabel,
  todayIso,
  zcRegionPath,
  type ZcPubblicazione,
  type ZcRegione,
} from "@/lib/zone-carenti";

const COME_SI_CANDIDA: Record<string, string> = {
  lombardia:
    "In Lombardia la domanda si presenta solo online sulla piattaforma regionale «Bandi e Servizi» (previa registrazione), con imposta di bollo di 16 euro pagata con carta di credito; i candidati sono poi convocati in una data unica regionale presso le sedi ASST indicate nel comunicato.",
  piemonte:
    "In Piemonte la domanda si invia solo con l'applicativo regionale GRMED, con accesso tramite SPID, CIE o CNS e imposta di bollo di 16 euro pagata online; la finestra resta aperta 20 giorni dal giorno successivo alla pubblicazione sul BUR.",
  toscana:
    "In Toscana si usa il modello di domanda allegato all'avviso (diverso per trasferimento, graduatoria e altre categorie), in bollo, da inviare solo via PEC dalla casella del candidato all'indirizzo indicato nell'avviso.",
  "emilia-romagna":
    "In Emilia-Romagna la domanda si compila e si invia solo online con il programma informatico regionale indicato nell'avviso (la domanda va «chiusa» dal medico), con marca da bollo di 16 euro; altre modalità comportano l'esclusione.",
};

const SORT_ASL = (a: { posti: number }, b: { posti: number }) => b.posti - a.posti;

function PubBadge({ p, today }: { p: ZcPubblicazione; today: string }) {
  const open = isOpen(p, today);
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-extrabold ${
        open ? "bg-primary text-white" : "bg-primary-soft text-muted"
      }`}
    >
      {open ? "Aperta" : "Scaduta"}
    </span>
  );
}

function SourceLinks({ p }: { p: ZcPubblicazione }) {
  const link = "inline-flex items-center gap-1 font-semibold text-primary hover:underline";
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a className={link} href={p.paginaUrl} target="_blank" rel="noopener noreferrer">
        Pagina ufficiale <ExternalLink size={13} aria-hidden="true" />
      </a>
      <a className={link} href={p.pdfUrl} target="_blank" rel="noopener noreferrer">
        Documento PDF <ExternalLink size={13} aria-hidden="true" />
      </a>
      {p.bollettinoUrl && p.bollettinoUrl !== p.paginaUrl ? (
        <a className={link} href={p.bollettinoUrl} target="_blank" rel="noopener noreferrer">
          Bollettino ufficiale <ExternalLink size={13} aria-hidden="true" />
        </a>
      ) : null}
    </p>
  );
}

function pubSummaryLine(p: ZcPubblicazione) {
  return `${p.bollettino}. Pubblicato il ${formatDate(p.pubblicatoIl)}.`;
}

function regionIntro(r: ZcRegione, today: string): string[] {
  const { byTipo, total, cur } = regionTotals(r);
  const parts = [...byTipo.entries()].map(([t, n]) => `${int(n)} ${TIPO_UNIT[t]} di ${TIPO_SHORT[t].toLowerCase()}`);
  const open = cur.filter((p) => isOpen(p, today));
  const out: string[] = [];
  out.push(
    `${r.nome}: nel 2026 l'ultima pubblicazione ufficiale (${r.bollettinoNome}) elenca ${int(total)} posti tra ${parts.join(", ")}. ` +
      `I dati provengono direttamente dagli avvisi della Regione e dei suoi uffici di medicina convenzionata; sotto trovi la tabella per ${r.slug === "lombardia" ? "ASST" : "azienda sanitaria"}, ambito territoriale e vincoli di apertura, con il link all'atto originale.`,
  );
  const ru = cur.find((p) => p.tipo === "ruolo-unico");
  if (ru && ru.perAsl.length > 1) {
    const sorted = [...ru.perAsl].sort(SORT_ASL);
    const top = sorted.slice(0, 3);
    const share = Math.round((top[0].posti / officialTotal(ru)) * 100);
    out.push(
      `Per la medicina generale la maggiore carenza è nell'azienda ${top[0].asl} con ${int(top[0].posti)} incarichi (circa il ${share}% del totale regionale)` +
        (top[1] ? `, seguita da ${top[1].asl} (${int(top[1].posti)})` : "") +
        (top[2] ? ` e ${top[2].asl} (${int(top[2].posti)})` : "") +
        `. In totale gli ambiti elencati sono ${int(ru.perAsl.reduce((a, x) => a + x.ambiti, 0))}, distribuiti su ${ru.perAsl.length} aziende.`,
    );
  }
  if (open.length > 0) {
    out.push(
      `Oggi sono aperte le candidature per: ${open.map((p) => `${TIPO_SHORT[p.tipo].toLowerCase()} (fino al ${formatDate(p.scadenza!)})`).join(", ")}.`,
    );
  } else {
    const last = [...cur].sort((a, b) => (b.scadenza ?? "").localeCompare(a.scadenza ?? ""))[0];
    out.push(
      `Al ${formatDate(today)} le finestre di candidatura delle pubblicazioni 2026 qui riportate sono chiuse${last?.scadenza ? ` (l'ultima è scaduta il ${formatDate(last.scadenza)})` : ""}. La pagina resta utile come riferimento: le Regioni ripubblicano le carenze durante l'anno e ripetono l'elenco ogni primavera.`,
    );
  }
  return out;
}

function faqFor(r: ZcRegione, today: string) {
  const { byTipo, total, cur } = regionTotals(r);
  const ru = cur.find((p) => p.tipo === "ruolo-unico");
  const items: { q: string; a: string }[] = [];
  items.push({
    q: `Quanti incarichi vacanti di medicina generale ci sono in ${r.nome} nel 2026?`,
    a: ru
      ? `Nell'ultima pubblicazione 2026 (${ru.bollettino}) la Regione ${r.nome} elenca ${int(officialTotal(ru))} incarichi vacanti del ruolo unico di assistenza primaria. Considerando anche pediatria ed emergenza territoriale i posti pubblicati sono ${int(total)}.`
      : `Per ${r.nome} sono pubblicati ${int(total)} posti complessivi tra i settori elencati in questa pagina.`,
  });
  const open = cur.filter((p) => isOpen(p, today));
  items.push({
    q: `Fino a quando si può presentare domanda per le zone carenti in ${r.nome}?`,
    a:
      open.length > 0
        ? `Sono aperte: ${open.map((p) => `${TIPO_SHORT[p.tipo]}, fino al ${formatDate(p.scadenza!)}`).join("; ")}. ${COME_SI_CANDIDA[r.slug]}`
        : `Le finestre delle pubblicazioni 2026 qui riportate sono chiuse: ${cur.map((p) => `${TIPO_SHORT[p.tipo]} (${p.scadenza ? "scaduta il " + formatDate(p.scadenza) : "senza scadenza indicata"})`).join("; ")}. Le Regioni possono ripubblicare gli incarichi rimasti vacanti durante l'anno: controlla la pagina ufficiale.`,
  });
  items.push({ q: `Come si presenta la domanda in ${r.nome}?`, a: COME_SI_CANDIDA[r.slug] });
  items.push({
    q: "Che fine ha fatto la guardia medica (continuità assistenziale)?",
    a: `Negli avvisi 2026 esaminati la continuità assistenziale (guardia medica) non compare come elenco separato: gli incarichi a quota oraria rientrano nel ruolo unico di assistenza primaria e si concorre alle stesse pubblicazioni. Resta distinta l'emergenza sanitaria territoriale (118).`,
  });
  items.push({
    q: "Chi può partecipare e in che ordine vengono assegnati gli incarichi?",
    a: "In genere possono concorrere, nell'ordine fissato dall'Accordo Collettivo Nazionale: i medici già titolari per trasferimento, quelli inseriti nella graduatoria regionale, i medici che hanno ottenuto il titolo dopo la scadenza della graduatoria, gli altri medici con formazione specifica e i medici iscritti al corso di formazione. Per la pediatria valgono criteri analoghi con la specializzazione in pediatria. Requisiti e punteggi sono nell'avviso ufficiale.",
  });
  items.push({
    q: "Dove trovo l'atto ufficiale?",
    a: `L'atto originale è pubblicato dalla Regione sul ${r.bollettinoNome} e sulla pagina istituzionale ${r.paginaUfficiale}. Questa pagina riassume i dati e non sostituisce l'avviso: prima di presentare domanda verifica sempre il testo ufficiale.`,
  });
  return items;
}

function AslTable({ p }: { p: ZcPubblicazione }) {
  const rows = [...p.perAsl].sort(SORT_ASL);
  return (
    <div className="overflow-x-auto">
      <table className="mt-3 w-full min-w-[20rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="pb-2 font-extrabold">Azienda sanitaria</th>
            <th className="pb-2 pl-3 text-right font-extrabold">Ambiti</th>
            <th className="pb-2 pl-3 text-right font-extrabold">Posti</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.asl} className="border-t border-border">
              <td className="py-2 pr-3 font-semibold">{a.asl}</td>
              <td className="py-2 pl-3 text-right tabular-nums">{int(a.ambiti)}</td>
              <td className="py-2 pl-3 text-right font-semibold tabular-nums">{int(a.posti)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VociByAsl({ p }: { p: ZcPubblicazione }) {
  const groups = new Map<string, NonNullable<ZcPubblicazione["voci"]>>();
  for (const v of p.voci ?? []) groups.set(v.asl, [...(groups.get(v.asl) ?? []), v]);
  const ordered = [...groups.entries()].sort((a, b) => b[1].reduce((s, x) => s + x.posti, 0) - a[1].reduce((s, x) => s + x.posti, 0));
  return (
    <div className="mt-4 space-y-2">
      {ordered.map(([asl, voci], i) => (
        <details key={asl} className="rounded-xl border border-border bg-surface" open={i === 0 && ordered.length > 1 ? true : ordered.length === 1}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-extrabold">
            {asl}
            <span className="ml-2 font-semibold text-muted">
              {int(voci.reduce((s, x) => s + x.posti, 0))} posti in {int(voci.length)} ambiti
            </span>
          </summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Ambito territoriale</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Posti</th>
                  <th className="pb-2 pl-3 font-extrabold">Vincoli di apertura</th>
                </tr>
              </thead>
              <tbody>
                {voci.map((v, idx) => (
                  <tr key={`${v.ambito}-${idx}`} className="border-t border-border align-top">
                    <td className="py-2 pr-3">{v.ambito}</td>
                    <td className="py-2 pl-3 text-right font-semibold tabular-nums">{int(v.posti)}</td>
                    <td className="py-2 pl-3 text-xs leading-5 text-muted">{v.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}

function jsonLd(data: unknown) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function RegionView({ regione }: { regione: ZcRegione }) {
  const today = todayIso();
  const cur = currentPublications(regione);
  const earlier = earlierPublications(regione);
  const intro = regionIntro(regione, today);
  const faq = faqFor(regione, today);
  const anyOpen = cur.some((p) => isOpen(p, today));
  const { total } = regionTotals(regione);
  const lastmod = regionLastmod(regione).toISOString();
  const path = zcRegionPath(regione.slug);
  const h1 = `Zone carenti medicina generale ${regione.nome} 2026: incarichi vacanti e ambiti`;
  const others = REGIONI.filter((r) => r.slug !== regione.slug);

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Ambiti carenti e incarichi vacanti di assistenza primaria 2026 - ${regione.nome}`,
    description: `Ambiti territoriali carenti e incarichi vacanti di medicina generale, pediatria di libera scelta ed emergenza territoriale pubblicati da ${regione.ente} nel 2026, per azienda sanitaria.`,
    url: absoluteUrl(path),
    creator: { "@type": "Organization", name: SITE_NAME },
    isBasedOn: cur.map((p) => p.paginaUrl),
    dateModified: lastmod,
    inLanguage: "it-IT",
    spatialCoverage: { "@type": "AdministrativeArea", name: regione.nome },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <main className="min-h-[70vh]">
      <section className="border-b border-border bg-surface py-8">
        <div className="page-container">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Zone carenti", href: ZC_HUB_PATH },
              { label: regione.nome },
            ]}
          />
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">{h1}</h1>
          <p className="mt-3 text-sm text-muted">
            Dati dalla pubblicazione ufficiale del {formatDate(lastmod.slice(0, 10))} · {int(total)} posti
          </p>
        </div>
      </section>

      <div className="page-container space-y-6 py-8">
        <div
          role="status"
          className={`content-card p-4 text-sm leading-6 ${anyOpen ? "border-primary" : ""}`}
        >
          {anyOpen ? (
            <p>
              <strong>Candidature aperte.</strong>{" "}
              {cur
                .filter((p) => isOpen(p, today))
                .map((p) => `${TIPO_SHORT[p.tipo]}: fino al ${formatDate(p.scadenza!)}`)
                .join(" · ")}
              . Le altre pubblicazioni 2026 sono scadute ma restano consultabili come riferimento.
            </p>
          ) : (
            <p>
              <strong>Candidature scadute (pubblicazione 2026).</strong> Le finestre di domanda delle pubblicazioni qui sotto sono chiuse. Le
              informazioni restano come riferimento annuale: controlla la pagina ufficiale per eventuali nuove pubblicazioni.
            </p>
          )}
        </div>

        <section className="content-card space-y-3 p-5 text-sm leading-7 sm:text-base">
          {intro.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p className="text-muted">
            Fonte: {regione.ente}, {regione.bollettinoNome}. Dati della pubblica amministrazione riutilizzati citando la fonte; nessun dato personale dei
            medici è riportato in questa pagina.
          </p>
        </section>

        {cur.map((p) => (
          <section key={p.id} id={p.id} className="content-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <PubBadge p={p} today={today} />
              <h2 className="text-xl font-extrabold">{TIPO_LABEL[p.tipo]}</h2>
            </div>
            <p className="mt-2 text-sm font-semibold">{p.titolo}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {pubSummaryLine(p)} Stato: <strong>{statusLabel(p, today)}</strong>
              {p.scadenzaCalcolata ? " (data calcolata: 20 giorni dalla pubblicazione, come previsto dall'avviso)" : ""}.{" "}
              {int(officialTotal(p))} {TIPO_UNIT[p.tipo]} in {int(p.perAsl.length)} aziende.
            </p>
            {p.nota ? <p className="mt-1 text-xs leading-5 text-muted">{p.nota}</p> : null}
            <SourceLinks p={p} />
            <AslTable p={p} />
            {p.tipo === "emergenza-territoriale" && (p.voci ?? []).every((v) => v.ambito === "Intero territorio aziendale") ? (
              <p className="mt-3 text-xs leading-5 text-muted">L&apos;avviso pubblica il numero di incarichi per azienda, senza elenco di ambiti.</p>
            ) : (
              <VociByAsl p={p} />
            )}
          </section>
        ))}

        {earlier.length > 0 && (
          <section className="content-card p-5">
            <h2 className="text-xl font-extrabold">Pubblicazioni precedenti del 2026</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Elenchi già sostituiti da pubblicazioni più recenti: riportiamo solo il totale per azienda, con il link all&apos;atto.
            </p>
            <div className="mt-3 space-y-5">
              {earlier.map((p) => (
                <div key={p.id}>
                  <h3 className="text-base font-extrabold">
                    {TIPO_SHORT[p.tipo]} · {p.edizione}
                  </h3>
                  <p className="text-sm leading-6 text-muted">
                    {pubSummaryLine(p)} {statusLabel(p, today)}. {int(officialTotal(p))} {TIPO_UNIT[p.tipo]}.
                  </p>
                  <SourceLinks p={p} />
                  <AslTable p={p} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="content-card p-5">
          <h2 className="text-xl font-extrabold">Cosa non è incluso</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {regione.esclusi.map((t) => (
              <li key={t}>{t}</li>
            ))}
            {regione.note.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="content-card p-5">
          <h2 className="text-xl font-extrabold">Domande frequenti</h2>
          <div className="mt-3 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-extrabold">{f.q}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="content-card p-5 text-sm leading-7">
          <h2 className="text-xl font-extrabold">Altre regioni e altri strumenti</h2>
          <p className="mt-2">
            Zone carenti in altre regioni:{" "}
            {others.map((r, i) => (
              <span key={r.slug}>
                {i > 0 ? ", " : ""}
                <Link href={zcRegionPath(r.slug)} className="font-semibold text-primary hover:underline">
                  {r.nome}
                </Link>
              </span>
            ))}
            . Panoramica nazionale:{" "}
            <Link href={ZC_HUB_PATH} className="font-semibold text-primary hover:underline">
              zone carenti in Italia
            </Link>
            .
          </p>
          <p className="mt-2">
            Cerchi un posto da dipendente? Vedi i{" "}
            <Link href="/concorsi" className="font-semibold text-primary hover:underline">
              concorsi aperti nella sanità
            </Link>{" "}
            e le{" "}
            <Link href="/offerte" className="font-semibold text-primary hover:underline">
              offerte di lavoro
            </Link>
            .
          </p>
        </section>
      </div>
      {jsonLd(dataset)}
      {jsonLd(faqLd)}
    </main>
  );
}

export function HubView() {
  const today = todayIso();
  const lazioOpen = LAZIO.scadenza >= today;
  const calendar = REGIONI.flatMap((r) => r.pubblicazioni.map((p) => ({ r, p }))).sort((a, b) => a.p.pubblicatoIl.localeCompare(b.p.pubblicatoIl));
  const totalAll = REGIONI.reduce((s, r) => s + regionTotals(r).total, 0);
  const faq = [
    {
      q: "Che cosa sono le zone carenti (ambiti carenti)?",
      a: "Sono gli ambiti territoriali in cui, secondo la programmazione della Regione e delle aziende sanitarie, mancano medici di assistenza primaria (medici di famiglia) o pediatri di libera scelta rispetto al numero di assistiti. Ogni Regione pubblica l'elenco degli incarichi vacanti, di norma una volta l'anno e con ripubblicazioni successive.",
    },
    {
      q: "Chi può candidarsi?",
      a: "Medici con il diploma di formazione specifica in medicina generale (o in corso di formazione, secondo l'avviso) e, per la pediatria, pediatri specialisti. Hanno precedenza, nell'ordine dell'Accordo Collettivo Nazionale, i medici già titolari che chiedono il trasferimento e quelli in graduatoria regionale.",
    },
    {
      q: "Quando escono le zone carenti?",
      a: "L'Accordo Collettivo Nazionale prevede una pubblicazione annuale, in genere in primavera (marzo-aprile), seguita da ripubblicazioni degli incarichi rimasti vacanti. Per l'emergenza territoriale (118) le pubblicazioni sono semestrali. Il calendario esatto cambia da Regione a Regione, come mostra la tabella di questa pagina.",
    },
    {
      q: "La guardia medica esiste ancora come incarico separato?",
      a: "Negli avvisi 2026 esaminati non c'è più un elenco separato di continuità assistenziale: gli incarichi orari rientrano nel ruolo unico di assistenza primaria. L'emergenza territoriale (118) resta un settore distinto.",
    },
    {
      q: "Questi dati sono ufficiali?",
      a: "Sono estratti dagli atti pubblicati dalle Regioni sui loro bollettini ufficiali e siti istituzionali; ogni tabella rimanda all'atto originale, che fa fede. Riutilizziamo dati della pubblica amministrazione citando la fonte e non pubblichiamo mai nomi, graduatorie nominative o punteggi di singoli medici.",
    },
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <main className="min-h-[70vh]">
      <section className="border-b border-border bg-surface py-8">
        <div className="page-container">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Zone carenti" }]} />
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
            Zone carenti 2026: incarichi vacanti per medici di famiglia, pediatri e 118
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
            Le Regioni pubblicano ogni anno gli ambiti carenti e gli incarichi vacanti di assistenza primaria: medicina generale (ruolo unico, che
            comprende la ex guardia medica), pediatria di libera scelta ed emergenza territoriale 118. Qui li raccogliamo per Regione, con tabelle
            per azienda sanitaria, scadenze e link agli atti ufficiali. Al momento: {int(totalAll)} posti in {REGIONI.length} regioni
            {lazioOpen ? ", più l'avviso del Lazio ancora aperto" : ""}.
          </p>
        </div>
      </section>

      <div className="page-container space-y-6 py-8">
        <section>
          <h2 className="text-xl font-extrabold">Regioni coperte</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {REGIONI.map((r) => {
              const t = regionTotals(r);
              const open = t.cur.filter((p) => isOpen(p, today));
              return (
                <Link key={r.slug} href={zcRegionPath(r.slug)} className="content-card block p-4 hover:border-primary">
                  <p className="text-lg font-extrabold">{r.nome}</p>
                  <p className="mt-1 text-sm text-muted">
                    {int(t.total)} posti ·{" "}
                    {[...t.byTipo.entries()].map(([k, n]) => `${TIPO_SHORT[k]} ${int(n)}`).join(" · ")}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {open.length > 0
                      ? `Candidature aperte: ${open.map((p) => `${TIPO_SHORT[p.tipo]} fino al ${formatDate(p.scadenza!)}`).join(", ")}`
                      : "Candidature scadute (pubblicazione 2026), pagina di riferimento"}
                  </p>
                </Link>
              );
            })}
            <a
              href={LAZIO.paginaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="content-card block p-4 hover:border-primary"
            >
              <p className="text-lg font-extrabold">
                Lazio <ExternalLink size={14} className="inline" aria-hidden="true" />
              </p>
              <p className="mt-1 text-sm text-muted">
                Avviso per il ruolo unico pubblicato il {formatDate(LAZIO.pubblicatoIl)} ({LAZIO.bollettino}). L&apos;elenco degli ambiti è
                nell&apos;allegato del BUR: per ora rimandiamo alla fonte ufficiale.
              </p>
              <p className="mt-2 text-sm font-semibold">
                {lazioOpen
                  ? `Candidature aperte fino al ${formatDate(LAZIO.scadenza)} (20 giorni dalla pubblicazione, data calcolata)`
                  : "Candidature scadute"}
              </p>
            </a>
          </div>
        </section>

        <section className="content-card p-5 text-sm leading-7">
          <h2 className="text-xl font-extrabold">Come candidarsi</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Controlla l&apos;elenco degli ambiti della tua Regione e scegli gli incarichi per cui hai i requisiti (titolo, residenza, anzianità).</li>
            <li>
              Presenta la domanda entro 20 giorni dalla pubblicazione sul bollettino ufficiale, solo con la modalità indicata nell&apos;avviso (portale
              regionale con SPID o CIE, oppure PEC), con la marca da bollo di 16 euro.
            </li>
            <li>Indica nella domanda, ove richiesto, l&apos;ordine di preferenza tra gli incarichi: l&apos;assegnazione segue la graduatoria e le priorità dell&apos;Accordo Collettivo Nazionale.</li>
            <li>Presentati alla convocazione (o invia la PEC di disponibilità se impedito): la mancata presentazione vale come rinuncia.</li>
          </ol>
          <p className="mt-3 text-muted">
            Le regole esatte cambiano da Regione a Regione: segui sempre l&apos;avviso ufficiale. Per i concorsi da dipendente vedi i{" "}
            <Link href="/concorsi" className="font-semibold text-primary hover:underline">
              concorsi aperti nella sanità
            </Link>
            .
          </p>
        </section>

        <section className="content-card p-5">
          <h2 className="text-xl font-extrabold">Calendario 2026 delle pubblicazioni</h2>
          <p className="mt-1 text-sm text-muted">Date reali delle pubblicazioni sui bollettini regionali e relative scadenze, in ordine cronologico.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 font-extrabold">Pubblicazione</th>
                  <th className="pb-2 pl-3 font-extrabold">Regione</th>
                  <th className="pb-2 pl-3 font-extrabold">Settore</th>
                  <th className="pb-2 pl-3 text-right font-extrabold">Posti</th>
                  <th className="pb-2 pl-3 font-extrabold">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {calendar.map(({ r, p }) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-3 tabular-nums">{formatDate(p.pubblicatoIl)}</td>
                    <td className="py-2 pl-3">
                      <Link href={zcRegionPath(r.slug)} className="font-semibold text-primary hover:underline">
                        {r.nome}
                      </Link>
                    </td>
                    <td className="py-2 pl-3">
                      {TIPO_SHORT[p.tipo]} <span className="text-muted">({p.edizione})</span>
                    </td>
                    <td className="py-2 pl-3 text-right font-semibold tabular-nums">{int(officialTotal(p))}</td>
                    <td className="py-2 pl-3">
                      {p.scadenza ? formatDate(p.scadenza) : "n.d."} <PubBadge p={p} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Le scadenze indicate come «20 giorni dalla pubblicazione» sono calcolate dalla data del bollettino. Nel 2026 le pubblicazioni ordinarie
            sono arrivate tra fine marzo e giugno, con ripubblicazioni e avvisi per il 118 in autunno.
          </p>
        </section>

        <section className="content-card p-5">
          <h2 className="text-xl font-extrabold">Domande frequenti</h2>
          <div className="mt-3 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-extrabold">{f.q}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      {jsonLd(faqLd)}
    </main>
  );
}

/** Riquadro per le landing di medicina e per /concorsi: porta alle zone carenti (medici di famiglia, pediatri, 118). */
export function ZoneCarentiCrosslink() {
  return (
    <p className="content-card p-5 text-sm leading-6 text-muted">
      Sei un medico di famiglia, un pediatra o lavori nel 118? Guarda gli{" "}
      <Link href={ZC_HUB_PATH} className="font-semibold text-primary hover:underline">
        incarichi vacanti e le zone carenti 2026 per regione
      </Link>
      .
    </p>
  );
}
