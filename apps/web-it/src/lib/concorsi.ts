import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { toCategorySlug, isKnownProfession, isKnownDistrict, districtFromSlug, professionFromSlug } from "@/lib/categories";
import { classifyJob, isConcorsoJob, JOB_TYPE_LABEL, type JobType } from "@/lib/job-type";
import { inRegione } from "@/lib/it-locative";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/** Una sotto-landing di professione esiste con almeno 1 bando aperto; professione x regione con almeno 3. */
export const CONCORSI_MIN_PROFESSION = 1;
export const CONCORSI_MIN_COMBO = 3;
/** Massimo di schede renderizzate per pagina (HTML leggero per Googlebot). */
export const CONCORSI_LIST_CAP = 60;

const isConcorsiProfession = (profession: string) =>
  profession !== "Altro" && isKnownProfession(profession);

export type ConcorsoItem = { job: Job; type: JobType };

export function concorsiPath(
  profession?: string | null,
  district?: string | null,
) {
  if (profession && district) {
    return `/concorsi/${toCategorySlug(profession)}/${toCategorySlug(district)}`;
  }
  if (profession) return `/concorsi/${toCategorySlug(profession)}`;
  return "/concorsi";
}

/** Bandi aperti del lavoro pubblico (concorsi, graduatorie, mobilita', avvisi), i piu recenti per primi. */
export function listConcorsi(jobs: Job[]): ConcorsoItem[] {
  const cached = listCache.get(jobs);
  if (cached) return cached;
  const list = buildConcorsi(jobs);
  listCache.set(jobs, list);
  return list;
}

const listCache = new WeakMap<Job[], ConcorsoItem[]>();

/** Esiste /concorsi/<professione> per questa professione? (almeno 1 bando aperto). */
export function hasConcorsoLanding(items: ConcorsoItem[], profession: string) {
  return (
    isConcorsiProfession(profession) &&
    items.some(({ job }) => job.profession === profession)
  );
}

function buildConcorsi(jobs: Job[]): ConcorsoItem[] {
  return jobs
    .filter(isConcorsoJob)
    .map((job) => ({ job, type: classifyJob(job) }))
    .sort(
      (a, b) =>
        b.job.publishedAt.localeCompare(a.job.publishedAt) ||
        a.job.title.localeCompare(b.job.title, "it"),
    );
}

export function filterConcorsi(
  items: ConcorsoItem[],
  profession: string | null,
  district: string | null,
) {
  return items.filter(
    ({ job }) =>
      (!profession || job.profession === profession) &&
      (!district || job.district === district),
  );
}

export function countBy<T>(values: T[]) {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "it"),
  );
}

export function concorsiProfessions(items: ConcorsoItem[]) {
  return countBy(items.map(({ job }) => job.profession).filter(isConcorsiProfession));
}

export function concorsiDistricts(items: ConcorsoItem[]) {
  return countBy(items.map(({ job }) => job.district).filter(isKnownDistrict));
}

export function professionLower(profession: string) {
  return profession === "OSS" ? "OSS" : profession.toLowerCase();
}

export type ConcorsoRef = {
  profession: string | null;
  district: string | null;
  path: string;
  count: number;
};

/** Pagine di /concorsi che devono esistere (hub escluso): professione con almeno 1 e combo con almeno 3. */
export function listEligibleConcorsi(items: ConcorsoItem[]): ConcorsoRef[] {
  const refs: ConcorsoRef[] = [];
  for (const [profession, count] of concorsiProfessions(items)) {
    if (count < CONCORSI_MIN_PROFESSION) continue;
    refs.push({ profession, district: null, path: concorsiPath(profession), count });
    const subset = filterConcorsi(items, profession, null);
    for (const [district, n] of concorsiDistricts(subset)) {
      if (n < CONCORSI_MIN_COMBO) continue;
      refs.push({ profession, district, path: concorsiPath(profession, district), count: n });
    }
  }
  return refs;
}

export function resolveConcorsoSegments(a?: string, b?: string) {
  const profession = a ? professionFromSlug(a) : null;
  if (a && (!profession || !isConcorsiProfession(profession))) return null;
  const district = b ? districtFromSlug(b) : null;
  if (b && !district) return null;
  return { profession, district };
}

/** Titolo di studio abituale (orientativo) per il blocco FAQ di ogni professione. */
const PROFESSION_REQUIREMENT: Record<string, string> = {
  Infermieristica:
    "Per i posti da infermiere si richiede di norma la laurea in Infermieristica (classe L/SNT1) e l'iscrizione all'albo professionale (OPI).",
  OSS:
    "Per i posti da OSS si richiede l'attestato di qualifica di Operatore Socio Sanitario, rilasciato al termine di un corso regionale.",
  Medicina:
    "Per i posti da medico si richiedono la laurea in Medicina e chirurgia, l'abilitazione e l'iscrizione all'Ordine; per la dirigenza medica serve di norma anche la specializzazione nella disciplina del bando.",
  Fisioterapia:
    "Per i posti da fisioterapista si richiede la laurea in Fisioterapia (classe L/SNT2) o titolo equipollente e l'iscrizione all'albo.",
  Ostetricia:
    "Per i posti da ostetrica/o si richiede la laurea in Ostetricia (classe L/SNT1) e l'iscrizione all'albo professionale.",
};

export function buildConcorsiFaq(
  items: ConcorsoItem[],
  profession: string | null,
  district: string | null,
) {
  const what = profession ? `per ${professionLower(profession)}` : "nella sanità";
  const where = district ? ` ${inRegione(district)}` : "";
  const total = items.length;
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `Quanti concorsi e avvisi pubblici ${what} sono aperti${where}?`,
      a: `In questo momento ci sono ${total} ${total === 1 ? "bando aperto" : "bandi aperti"} su ${SITE_NAME}. L'elenco viene aggiornato più volte al giorno a partire dalle fonti ufficiali degli enti.`,
    },
    {
      q: "Che differenza c'è tra concorso, graduatoria e avviso a tempo determinato?",
      a: "Il concorso pubblico (per titoli ed esami) porta all'assunzione a tempo indeterminato. La graduatoria è l'elenco degli idonei da cui l'ente attinge per assunzioni, anche a tempo determinato. L'avviso pubblico a tempo determinato serve a coprire esigenze temporanee, come sostituzioni o progetti.",
    },
    {
      q: "Che cos'è la mobilità?",
      a: "È la procedura con cui il personale già assunto a tempo indeterminato in una pubblica amministrazione può trasferirsi presso un altro ente. Ogni avviso indica requisiti, scadenza e modalità di domanda.",
    },
    {
      q: "Dove vengono pubblicati i bandi?",
      a: "Sui siti istituzionali degli enti (sezione Amministrazione trasparente o Bandi di concorso) e, per i concorsi, nei canali ufficiali indicati dal bando. In ogni scheda rimandiamo alla fonte ufficiale: lì trovi requisiti, tasse e scadenza.",
    },
    {
      q: "Come mi candido?",
      a: `Apri il bando, leggilo con attenzione e usa il pulsante «Candidati»: la domanda si presenta sempre sul sito o sul portale dell'ente che bandisce, non su ${SITE_NAME}. La scadenza è fissata da ciascun bando, quindi verificala sempre.`,
    },
  ];
  if (profession && PROFESSION_REQUIREMENT[profession]) {
    faq.splice(1, 0, {
      q: `Quale titolo serve per i concorsi ${what}?`,
      a: `${PROFESSION_REQUIREMENT[profession]} I requisiti esatti dipendono da ciascun bando.`,
    });
  }
  faq.push({
    q: "Posso ricevere un avviso per i nuovi bandi?",
    a: "Sì. Crea un avviso gratuito indicando professione e regione: ti scriviamo via email quando compare una nuova offerta, compresi concorsi e graduatorie.",
  });
  return faq;
}

export function buildConcorsiHeading(profession: string | null, district: string | null) {
  if (profession && district) {
    return `Concorsi per ${professionLower(profession)} ${inRegione(district)}`;
  }
  if (profession) return `Concorsi per ${professionLower(profession)}`;
  return "Concorsi e avvisi pubblici nella sanità";
}

/** L'anno viene calcolato alla rigenerazione della pagina (ISR), non fissato a mano. */
export function currentYear() {
  return new Date().getFullYear();
}

export function buildConcorsiMetadata(
  profession: string | null,
  district: string | null,
  count: number,
): Metadata {
  const year = currentYear();
  const n = count === 1 ? "1 bando aperto" : `${count} bandi aperti`;
  const path = concorsiPath(profession, district);
  const title =
    profession && district
      ? `Concorsi per ${professionLower(profession)} ${inRegione(district)} ${year}: ${n}`
      : profession
        ? `Concorsi per ${professionLower(profession)} ${year}: ${n}`
        : `Concorsi pubblici nella sanità ${year}: ${n}`;
  const description = truncateMeta(
    profession
      ? `${n} tra concorsi, graduatorie e avvisi pubblici per ${professionLower(profession)}${district ? ` ${inRegione(district)}` : " in tutta Italia"}, con link al bando ufficiale. Aggiornati ogni giorno.`
      : `${n} tra concorsi, graduatorie, mobilità e avvisi pubblici della sanità, con link al bando ufficiale. Filtra per professione e regione. Aggiornato ogni giorno.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildConcorsiItemListJsonLd(
  name: string,
  path: string,
  items: ConcorsoItem[],
) {
  const shown = items.slice(0, CONCORSI_LIST_CAP);
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

export { JOB_TYPE_LABEL };
