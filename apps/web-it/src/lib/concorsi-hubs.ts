import type { Metadata } from "next";
import { toCategorySlug } from "@/lib/categories";
import { classifyJob, JOB_TYPE_LABEL, type JobType } from "@/lib/job-type";
import { daysUntilDeadline, shortDate } from "@/lib/job-display";
import { displayTitle } from "@/lib/display-title";
import {
  concorsiPath,
  countBy,
  currentYear,
  professionLower,
  type ConcorsoItem,
} from "@/lib/concorsi";
import { inRegione } from "@/lib/it-locative";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/** /concorsi/in-scadenza/<professione> esiste solo con almeno 3 bandi in scadenza (entro 14 giorni). */
export const EXPIRING_MIN_PROFESSION = 3;
/** Pagina di tipo indicizzabile solo con almeno 3 bandi. */
export const TYPE_MIN_INDEXABLE = 3;
export const EXPIRING_SHORT_DAYS = 7;
export const EXPIRING_LONG_DAYS = 14;

export const EXPIRING_PATH = "/concorsi/in-scadenza";
export const expiringProfessionPath = (profession: string) =>
  `${EXPIRING_PATH}/${toCategorySlug(profession)}`;

/** Bandi con scadenza entro `days` giorni (oggi incluso), per scadenza crescente. */
export function expiringItems(
  items: ConcorsoItem[],
  days: number,
  now = Date.now(),
): ConcorsoItem[] {
  return items
    .filter(({ job }) => {
      const left = daysUntilDeadline(job.expiresAt, now);
      return left !== null && left >= 0 && left <= days;
    })
    .sort(
      (a, b) =>
        Date.parse(a.job.expiresAt as string) - Date.parse(b.job.expiresAt as string) ||
        a.job.title.localeCompare(b.job.title, "it"),
    );
}

/** Professioni con almeno EXPIRING_MIN_PROFESSION bandi in scadenza entro 14 giorni. */
export function expiringProfessions(items: ConcorsoItem[], now = Date.now()) {
  const soon = expiringItems(items, EXPIRING_LONG_DAYS, now);
  return countBy(soon.map(({ job }) => job.profession)).filter(
    ([name, n]) => name !== "Altro" && n >= EXPIRING_MIN_PROFESSION,
  );
}

/** lastmod reale: l'ultimo aggiornamento tra i bandi dell'insieme (ultima volta visto dalla fonte o pubblicazione). */
export function itemsLastmod(items: ConcorsoItem[]): Date {
  let best = 0;
  for (const { job } of items) {
    for (const value of [job.lastSeenAt, job.publishedAt]) {
      const t = value ? Date.parse(value) : NaN;
      if (!Number.isNaN(t) && t <= Date.now() && t > best) best = t;
    }
  }
  return new Date(best || Date.now());
}

export type TypePage = {
  slug: string;
  type: JobType;
  /** Nome breve (minuscolo) per le frasi. */
  noun: string;
  h1: string;
  titleLead: string;
  blurb: string;
};

export const TYPE_PAGES: TypePage[] = [
  {
    slug: "concorsi-pubblici",
    type: "concorso",
    noun: "concorsi pubblici",
    h1: "Concorsi pubblici nella sanità",
    titleLead: "Concorsi pubblici sanità",
    blurb:
      "Il concorso pubblico (per titoli ed esami o per soli esami) porta all'assunzione a tempo indeterminato nelle aziende sanitarie, negli ospedali e negli enti del Servizio sanitario nazionale.",
  },
  {
    slug: "avvisi-tempo-determinato",
    type: "tempo_determinato",
    noun: "avvisi a tempo determinato",
    h1: "Avvisi pubblici a tempo determinato nella sanità",
    titleLead: "Avvisi a tempo determinato sanità",
    blurb:
      "L'avviso pubblico a tempo determinato serve a coprire esigenze temporanee di aziende sanitarie ed enti pubblici: sostituzioni, progetti, carenze di organico. Di solito la selezione è più rapida di quella di un concorso.",
  },
  {
    slug: "mobilita",
    type: "mobilita",
    noun: "avvisi di mobilità",
    h1: "Avvisi di mobilità nella sanità",
    titleLead: "Mobilità sanità",
    blurb:
      "La mobilità è la procedura con cui il personale già assunto a tempo indeterminato in una pubblica amministrazione può trasferirsi presso un altro ente. Ogni avviso indica profilo, requisiti e scadenza.",
  },
  {
    slug: "incarichi-libero-professionali",
    type: "incarico",
    noun: "incarichi libero-professionali",
    h1: "Incarichi libero-professionali e collaborazioni nella sanità",
    titleLead: "Incarichi libero-professionali sanità",
    blurb:
      "Gli incarichi libero-professionali e le collaborazioni sono avvisi con cui un ente pubblico affida un'attività a un professionista con partita IVA o con contratto di collaborazione, senza assunzione.",
  },
  {
    slug: "graduatorie",
    type: "graduatoria",
    noun: "graduatorie",
    h1: "Graduatorie e elenchi idonei nella sanità",
    titleLead: "Graduatorie sanità",
    blurb:
      "Le graduatorie sono gli elenchi di idonei da cui gli enti attingono per le assunzioni. In questa pagina compaiono solo titolo, ente e data dell'avviso, con il collegamento al documento ufficiale: non pubblichiamo nomi né punteggi dei candidati.",
  },
];

export const typePageBySlug = (slug: string) => TYPE_PAGES.find((p) => p.slug === slug) ?? null;
export const typePagePath = (slug: string) => `/concorsi/tipo/${slug}`;

export function itemsOfType(items: ConcorsoItem[], type: JobType) {
  return items.filter((item) => item.type === type);
}

/** Frase con i principali enti e il numero di bandi: «ASST Papa Giovanni XXIII (4), ...». */
export function topEmployersText(items: ConcorsoItem[], limit = 3) {
  return countBy(items.map(({ job }) => job.company).filter(Boolean))
    .slice(0, limit)
    .map(([name, n]) => `${name} (${n})`)
    .join(", ");
}

export function topDistrictsText(items: ConcorsoItem[], limit = 3) {
  return countBy(items.map(({ job }) => job.district).filter(Boolean))
    .slice(0, limit)
    .map(([name, n]) => `${name} (${n})`)
    .join(", ");
}

export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("it-IT")} ${n === 1 ? one : many}`;
}

const TYPE_PLURAL: Record<JobType, [string, string]> = {
  concorso: ["concorso pubblico", "concorsi pubblici"],
  graduatoria: ["graduatoria", "graduatorie"],
  mobilita: ["avviso di mobilità", "avvisi di mobilità"],
  tempo_determinato: ["avviso a tempo determinato", "avvisi a tempo determinato"],
  incarico: ["incarico libero-professionale", "incarichi libero-professionali"],
  offerta: ["offerta di lavoro", "offerte di lavoro"],
};

/** «12 concorsi pubblici, 5 avvisi a tempo determinato, ...» in ordine decrescente. */
export function typeBreakdownText(items: ConcorsoItem[]) {
  return countBy(items.map(({ type }) => type))
    .map(([type, n]) => `${n} ${TYPE_PLURAL[type][n === 1 ? 0 : 1]}`)
    .join(", ");
}

const PROFESSION_PEOPLE: Record<string, string> = {
  Infermieristica: "infermieri",
  Medicina: "medici",
  OSS: "OSS",
  Fisioterapia: "fisioterapisti",
  "Tecnici sanitari": "tecnici sanitari",
  Ostetricia: "ostetriche",
  Farmacia: "farmacisti",
  Psicologia: "psicologi",
  Veterinaria: "veterinari",
  "Gestione e supporto": "gestione e supporto",
};

/** Plurale di persone per titoli e frasi delle landing nuove («infermieri», «medici»). */
export function professionPeople(profession: string) {
  return PROFESSION_PEOPLE[profession] ?? professionLower(profession);
}

export function todayLabel(now = Date.now()) {
  return new Date(now).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

/** Frase sulla prima scadenza: «Il primo a scadere è «Titolo» (Ente), il 25/11.» */
export function firstDeadlineText(items: ConcorsoItem[], now = Date.now()) {
  const first = expiringItems(items, 365, now)[0];
  if (!first) return "";
  const date = shortDate(first.job.expiresAt) ?? "";
  return `Il primo a scadere è «${displayTitle(first.job.title, first.job)}» (${first.job.company}), il ${date}.`;
}

export function classifyOf(item: ConcorsoItem) {
  return item.type ?? classifyJob(item.job);
}

export type HubConfig = {
  slug: string;
  path: string;
  profession: string;
  /** «infermieri», «OSS» */
  plural: string;
  /** Titolo breve per le ricerche. */
  titleLead: string;
  h1Lead: string;
  careerSlug: string;
  otherHub: string;
  guides: Array<{ slug: string; label: string }>;
  requirement: string;
  applyNote: string;
};

export const HUBS: HubConfig[] = [
  {
    slug: "concorsi-infermieri-2026",
    path: "/concorsi-infermieri-2026",
    profession: "Infermieristica",
    plural: "infermieri",
    titleLead: "Concorsi infermieri",
    h1Lead: "Concorsi infermieri",
    careerSlug: "infermiere",
    otherHub: "/concorsi-oss-2026",
    guides: [
      { slug: "come-funzionano-concorsi-pubblici-sanita", label: "Come funzionano i concorsi pubblici nella sanità" },
      { slug: "come-leggere-bando-concorso-sanita", label: "Come leggere un bando di concorso" },
      { slug: "iscrizione-albo-professioni-sanitarie", label: "Iscrizione all'albo delle professioni sanitarie" },
      { slug: "curriculum-vitae-sanita", label: "Il curriculum per la sanità" },
    ],
    requirement:
      "Per i concorsi da infermiere si richiede di norma la laurea in Infermieristica (classe L/SNT1) o un titolo equipollente e l'iscrizione all'albo professionale (OPI). I requisiti esatti, compresi eventuali titoli di servizio, sono quelli del singolo bando.",
    applyNote:
      "La domanda si presenta online, di solito sul portale inPA o sulla piattaforma indicata dal bando, entro la scadenza.",
  },
  {
    slug: "concorsi-oss-2026",
    path: "/concorsi-oss-2026",
    profession: "OSS",
    plural: "OSS",
    titleLead: "Concorso OSS",
    h1Lead: "Concorsi OSS",
    careerSlug: "oss",
    otherHub: "/concorsi-infermieri-2026",
    guides: [
      { slug: "lavorare-come-oss-italia", label: "Lavorare come OSS in Italia" },
      { slug: "come-funzionano-concorsi-pubblici-sanita", label: "Come funzionano i concorsi pubblici nella sanità" },
      { slug: "come-leggere-bando-concorso-sanita", label: "Come leggere un bando di concorso" },
      { slug: "curriculum-vitae-sanita", label: "Il curriculum per la sanità" },
    ],
    requirement:
      "Per i concorsi da OSS si richiede l'attestato di qualifica di Operatore Socio Sanitario, rilasciato al termine di un corso regionale. Nei concorsi pubblici il titolo di studio di base e gli altri requisiti sono indicati nel bando.",
    applyNote:
      "La domanda si presenta online, di solito sul portale inPA o sulla piattaforma indicata dal bando, entro la scadenza.",
  },
];

export const hubForProfession = (profession: string | null) =>
  HUBS.find((hub) => hub.profession === profession) ?? null;

export function hubMetadata(hub: HubConfig, count: number): Metadata {
  const year = currentYear();
  const title =
    hub.profession === "OSS"
      ? `Concorso OSS ${year}: ${count} bandi aperti, scadenze e regioni`
      : `Concorsi infermieri ${year}: ${count} bandi aperti, scadenze e regioni`;
  const description = truncateMeta(
    `${count} ${count === 1 ? "bando aperto" : "bandi aperti"} per ${hub.plural}: concorsi pubblici, avvisi a tempo determinato, mobilità e graduatorie, divisi per regione e con le scadenze. Link al bando ufficiale, aggiornato ogni giorno.`,
    160,
  );
  const robots = count === 0 ? { index: false, follow: true } : undefined;
  return {
    title,
    description,
    alternates: { canonical: hub.path },
    openGraph: { title, description, url: hub.path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
    ...(robots ? { robots } : {}),
  };
}

export function expiringMetadata(
  profession: string | null,
  count: number,
  within7: number,
): Metadata {
  const year = currentYear();
  const path = profession ? expiringProfessionPath(profession) : EXPIRING_PATH;
  const what = profession ? ` ${professionPeople(profession)}` : " sanità";
  const title = profession
    ? `Concorsi${what} in scadenza ${year}: ${count} bandi entro 14 giorni`
    : `Concorsi sanità in scadenza ${year}: ${count} bandi entro 14 giorni`;
  const description = truncateMeta(
    `Bandi e avvisi pubblici${profession ? ` per ${professionPeople(profession)}` : " della sanità"} ancora aperti che scadono entro 7 e 14 giorni (${within7} entro 7 giorni), in ordine di scadenza e con link al bando ufficiale.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export function typeMetadata(page: TypePage, count: number): Metadata {
  const year = currentYear();
  const path = typePagePath(page.slug);
  const title = `${page.titleLead} ${year}: ${count} ${count === 1 ? "avviso aperto" : "avvisi aperti"}`;
  const description = truncateMeta(
    page.type === "graduatoria"
      ? `${count} ${count === 1 ? "graduatoria" : "graduatorie"} e elenchi di idonei di ASL, ASST e ospedali, con ente, data e link al documento ufficiale. Nessun nome o punteggio dei candidati.`
      : `${count} ${page.noun} aperti nella sanità, per professione e regione, con scadenza e link al bando ufficiale. Aggiornati ogni giorno dalle fonti degli enti.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
    ...(count < TYPE_MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export function itemListJsonLd(name: string, path: string, items: ConcorsoItem[], cap = 60) {
  const shown = items.slice(0, cap);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: shown.length,
    itemListElement: shown.map(({ job }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/offerte/${job.slug}`),
      name: job.title,
    })),
  };
}

export { concorsiPath, inRegione };
