import type { Job } from "@/lib/jobs";
import {
  districts as categoryDistricts,
  professions as taxonomyProfessions,
} from "@/lib/taxonomies";
import { inRegione, inProvincia } from "@/lib/it-locative";
import {
  PROVINCES_BY_REGION,
  jobProvince,
  provinceFromSlug,
  provinceSlug,
} from "@/lib/provinces";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const CATEGORY_MIN_JOBS = 3;

const PROFESSION_LABELS = [...taxonomyProfessions, "Altro"] as const;

/** Le 20 regioni italiane valide per le landing. */
export const CATEGORY_DISTRICTS = categoryDistricts;

function normalizeKey(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Slug espliciti per le etichette lunghe (devono coincidere con scrapers-it PROFESSION_SLUGS). */
const SLUG_OVERRIDES: Record<string, string> = {
  "Nutrizione e dietistica": "nutrizione-dietistica",
  "Logopedia e riabilitazione": "logopedia-riabilitazione",
};

export function toCategorySlug(label: string) {
  return SLUG_OVERRIDES[label] ?? normalizeKey(label);
}

const PROFESSION_BY_SLUG = new Map(
  PROFESSION_LABELS.map((label) => [toCategorySlug(label), label] as const),
);
const DISTRICT_BY_SLUG = new Map(
  CATEGORY_DISTRICTS.map((label) => [toCategorySlug(label), label] as const),
);

export function professionFromSlug(slug: string) {
  return PROFESSION_BY_SLUG.get(slug) ?? null;
}

export function districtFromSlug(slug: string) {
  return DISTRICT_BY_SLUG.get(slug) ?? null;
}

export function isKnownProfession(label: string) {
  return PROFESSION_BY_SLUG.has(toCategorySlug(label));
}

export function isKnownDistrict(label: string) {
  return DISTRICT_BY_SLUG.has(toCategorySlug(label));
}

export function isReservedCategorySlug(slug: string) {
  return PROFESSION_BY_SLUG.has(slug) || DISTRICT_BY_SLUG.has(slug);
}

export type CategoryKind = "profession" | "district" | "combo" | "province";

export type CategoryRef = {
  kind: CategoryKind;
  profession: string | null;
  district: string | null;
  /** Solo nelle landing di provincia (/offerte/<regione>/<provincia>). */
  province?: string | null;
  path: string;
  title: string;
};

/** Offerte per pagina nelle landing (l'HTML con migliaia di card superava i 15 MB di Googlebot). */
export const CATEGORY_PAGE_SIZE = 50;

export function categoryTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / CATEGORY_PAGE_SIZE));
}

/** Pagina 1 = URL base; le successive in /pagina-N (self-canonical). */
export function categoryPagePath(path: string, page: number) {
  return page > 1 ? `${path}/pagina-${page}` : path;
}

/** "pagina-2" -> 2. La pagina 1 non ha un segmento proprio (restituisce null). */
export function parseCategoryPageSegment(segment: string | undefined) {
  const match = segment?.match(/^pagina-(\d{1,4})$/);
  if (!match) return null;
  const page = Number(match[1]);
  return page >= 2 ? page : null;
}

/** "pagina-1" -> redirect all'URL base della landing. */
export function isFirstPageSegment(segment: string | undefined) {
  return Boolean(segment && /^pagina-0*1$/.test(segment));
}

export function sliceCategoryPage<T>(jobs: T[], page: number) {
  const start = (page - 1) * CATEGORY_PAGE_SIZE;
  return jobs.slice(start, start + CATEGORY_PAGE_SIZE);
}

/** /offerte/<regione>/<provincia> */
export function provincePath(district: string, province: string) {
  return `/offerte/${toCategorySlug(district)}/${provinceSlug(province)}`;
}

export function categoryPath(
  profession: string | null | undefined,
  district: string | null | undefined,
) {
  const p = profession ? toCategorySlug(profession) : null;
  const d = district ? toCategorySlug(district) : null;
  if (p && d) return `/offerte/${p}/${d}`;
  if (p) return `/offerte/${p}`;
  if (d) return `/offerte/${d}`;
  return "/offerte";
}

/** Titolo H1 / SEO della landing (professione, regione o combinazione). */
export function categoryHeading(
  kind: CategoryKind,
  profession: string | null,
  district: string | null,
  province: string | null = null,
) {
  if (kind === "combo" && profession && district) {
    return `Offerte di ${profession} ${inRegione(district)}`;
  }
  if (kind === "profession" && profession) {
    return `Offerte di ${profession} in Italia`;
  }
  if (kind === "province" && province) {
    return `Offerte di lavoro nella sanità ${inProvincia(province)}`;
  }
  if (district) {
    return `Offerte di lavoro nella sanità ${inRegione(district)}`;
  }
  return "Offerte di lavoro nella sanità";
}

export function resolveCategoryFromSegments(
  a: string,
  b?: string,
): CategoryRef | null {
  if (b) {
    const regionOfA = districtFromSlug(a);
    if (regionOfA) {
      const province = provinceFromSlug(regionOfA, b);
      if (!province) return null;
      return {
        kind: "province",
        profession: null,
        district: regionOfA,
        province,
        path: provincePath(regionOfA, province),
        title: categoryHeading("province", null, regionOfA, province),
      };
    }
    const profession = professionFromSlug(a);
    const district = districtFromSlug(b);
    if (!profession || !district) return null;
    return {
      kind: "combo",
      profession,
      district,
      path: categoryPath(profession, district),
      title: categoryHeading("combo", profession, district),
    };
  }

  const profession = professionFromSlug(a);
  if (profession) {
    return {
      kind: "profession",
      profession,
      district: null,
      path: categoryPath(profession, null),
      title: categoryHeading("profession", profession, null),
    };
  }

  const district = districtFromSlug(a);
  if (district) {
    return {
      kind: "district",
      profession: null,
      district,
      path: categoryPath(null, district),
      title: categoryHeading("district", null, district),
    };
  }

  return null;
}

export function filterJobsForCategory(
  jobs: Job[],
  profession: string | null,
  district: string | null,
  province: string | null = null,
) {
  return jobs.filter((job) => {
    if (profession && job.profession !== profession) return false;
    if (district && job.district !== district) return false;
    if (province && jobProvince(job) !== province) return false;
    return true;
  });
}

export type CategoryStats = {
  jobs: Job[];
  count: number;
  topCompanies: Array<{ name: string; count: number }>;
  sectorCounts: Array<{ name: string; count: number }>;
  contractCounts: Array<{ name: string; count: number }>;
  districtCounts: Array<{ name: string; count: number }>;
  professionCounts: Array<{ name: string; count: number }>;
};

function topCounts(
  values: string[],
  limit = 5,
): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || "Altro";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.name.localeCompare(b.name, "it"),
    )
    .slice(0, limit);
}

export function buildCategoryStats(jobs: Job[]): CategoryStats {
  return {
    jobs,
    count: jobs.length,
    topCompanies: topCounts(
      jobs.map((job) => job.company),
      5,
    ),
    sectorCounts: topCounts(
      jobs.map((job) => job.sector),
      3,
    ),
    contractCounts: topCounts(
      jobs.map((job) => job.contract),
      4,
    ),
    districtCounts: topCounts(
      jobs.map((job) => job.district),
      8,
    ),
    professionCounts: topCounts(
      jobs.map((job) => job.profession),
      8,
    ),
  };
}

export function listEligibleCategories(jobs: Job[]): CategoryRef[] {
  const refs: CategoryRef[] = [];

  const professions = new Set(
    jobs.map((job) => job.profession).filter(isKnownProfession),
  );
  for (const profession of professions) {
    const subset = filterJobsForCategory(jobs, profession, null);
    if (subset.length < CATEGORY_MIN_JOBS) continue;
    refs.push({
      kind: "profession",
      profession,
      district: null,
      path: categoryPath(profession, null),
      title: categoryHeading("profession", profession, null),
    });
  }

  const districts = new Set(
    jobs.map((job) => job.district).filter(isKnownDistrict),
  );
  for (const district of districts) {
    const subset = filterJobsForCategory(jobs, null, district);
    if (subset.length < CATEGORY_MIN_JOBS) continue;
    refs.push({
      kind: "district",
      profession: null,
      district,
      path: categoryPath(null, district),
      title: categoryHeading("district", null, district),
    });
  }

  for (const profession of professions) {
    for (const district of districts) {
      const subset = filterJobsForCategory(jobs, profession, district);
      if (subset.length < CATEGORY_MIN_JOBS) continue;
      refs.push({
        kind: "combo",
        profession,
        district,
        path: categoryPath(profession, district),
        title: categoryHeading("combo", profession, district),
      });
    }
  }

  // Secondo livello: province delle regioni con piu di una provincia.
  for (const [district, provinces] of Object.entries(PROVINCES_BY_REGION)) {
    const inRegion = jobs.filter((job) => job.district === district);
    if (inRegion.length < CATEGORY_MIN_JOBS) continue;
    for (const province of provinces) {
      const subset = filterJobsForCategory(inRegion, null, district, province);
      if (subset.length < CATEGORY_MIN_JOBS) continue;
      refs.push({
        kind: "province",
        profession: null,
        district,
        province,
        path: provincePath(district, province),
        title: categoryHeading("province", null, district, province),
      });
    }
  }

  return refs
    .filter((ref) => {
      // Garantisce che il path si risolva nella rotta (evita chip 404).
      const segments = ref.path.replace(/^\/offerte\//, "").split("/");
      return Boolean(resolveCategoryFromSegments(segments[0], segments[1]));
    })
    .sort((a, b) => a.path.localeCompare(b.path, "it"));
}

/** Chip per home/elenco: solo categorie con pagina reale, per volume. */
export function listCategoryChips(jobs: Job[], limit = 10): CategoryRef[] {
  return listEligibleCategories(jobs)
    .filter((item) => item.kind === "profession" || item.kind === "district")
    .map((item) => ({
      item,
      count: filterJobsForCategory(jobs, item.profession, item.district).length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.item.path.localeCompare(b.item.path, "it"),
    )
    .slice(0, limit)
    .map(({ item }) => item);
}

export function isCategoryEligible(
  jobs: Job[],
  profession: string | null,
  district: string | null,
  province: string | null = null,
) {
  return (
    filterJobsForCategory(jobs, profession, district, province).length >=
    CATEGORY_MIN_JOBS
  );
}

export function buildCategoryIntro(
  stats: CategoryStats,
  profession: string | null,
  district: string | null,
) {
  const where = district ? inRegione(district) : "in Italia";
  const what = profession
    ? `offerte di ${profession.toLowerCase()}`
    : "offerte di lavoro nella sanità";
  const companies = stats.topCompanies
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");
  const sectors = stats.sectorCounts
    .map((item) => `${item.count} nel settore ${item.name.toLowerCase()}`)
    .join(", ");
  const contracts = stats.contractCounts
    .slice(0, 3)
    .map((item) => item.name.toLowerCase())
    .join(", ");

  const focus =
    profession && district
      ? `Questa pagina raccoglie le opportunità di ${profession.toLowerCase()} ${where}, aggiornate a partire da fonti pubbliche e private.`
      : profession
        ? `Qui trovi ${what} in diverse regioni, con filtri per località e settore.`
        : `Qui trovi ${what} ${where}, raccolte da ospedali, aziende sanitarie, laboratori e altre strutture.`;

  const employerLine = companies
    ? `Tra le strutture che stanno assumendo in questo momento: ${companies}.`
    : `Le offerte provengono da strutture sanitarie di tutta Italia.`;

  const mixLine = sectors
    ? `In questo momento ci sono ${stats.count} ${stats.count === 1 ? "offerta attiva" : "offerte attive"}: ${sectors}.`
    : `In questo momento ci sono ${stats.count} ${stats.count === 1 ? "offerta attiva" : "offerte attive"}.`;

  const contractLine = contracts
    ? `I tipi di contratto più frequenti sono: ${contracts}.`
    : "";

  const cta =
    "Puoi candidarti direttamente sul sito della struttura oppure creare un avviso per ricevere nuove opportunità via email.";

  const text = [focus, mixLine, employerLine, contractLine, cta]
    .filter(Boolean)
    .join(" ");

  if (text.length <= 150 * 6) return text;
  return truncateMeta(text, 900);
}

/** Come compare la professione nelle ricerche "lavoro ..." (GSC). */
const PROFESSION_SEARCH_PHRASE: Record<string, string> = {
  Infermieristica: "Lavoro per infermieri",
  Medicina: "Lavoro per medici",
  OSS: "Lavoro per OSS",
  Fisioterapia: "Lavoro per fisioterapisti",
  "Tecnici sanitari": "Lavoro per tecnici sanitari",
  Ostetricia: "Lavoro per ostetriche",
  Farmacia: "Lavoro per farmacisti",
  Psicologia: "Lavoro per psicologi",
  "Nutrizione e dietistica": "Lavoro per dietisti e nutrizionisti",
  Odontoiatria: "Lavoro per odontoiatri",
  "Logopedia e riabilitazione": "Lavoro per logopedisti e riabilitazione",
  "Ottica e audiometria": "Lavoro per ottici e audioprotesisti",
  Veterinaria: "Lavoro per veterinari",
  "Servizio sociale": "Lavoro per assistenti sociali",
  Formazione: "Lavoro nella formazione sanitaria",
  "Gestione e supporto": "Lavoro nella gestione sanitaria",
  Amministrativo: "Lavoro amministrativo nella sanità",
  Altro: "Lavoro nella sanità",
};

function professionSearchPhrase(profession: string) {
  return PROFESSION_SEARCH_PHRASE[profession] ?? `Lavoro: ${profession}`;
}

const FRESH_DAYS = 7;

function countRecent(jobs: Job[] | undefined) {
  if (!jobs) return 0;
  const cutoff = Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000;
  return jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

export function buildCategoryMetadata(
  ref: CategoryRef,
  count: number,
  jobs?: Job[],
  page = 1,
): Metadata {
  const offerte = count === 1 ? "1 offerta" : `${count} offerte`;
  const baseTitle =
    ref.kind === "province" && ref.province
      ? `Lavoro nella sanità ${inProvincia(ref.province)}: ${offerte}`
      : ref.kind === "combo" && ref.profession && ref.district
      ? `${professionSearchPhrase(ref.profession)} ${inRegione(ref.district)}: ${offerte}`
      : ref.kind === "profession" && ref.profession
        ? `${professionSearchPhrase(ref.profession)}: ${offerte} in Italia`
        : `Lavoro nella sanità ${ref.district ? inRegione(ref.district) : "in Italia"}: ${offerte}`;
  const title = page > 1 ? `${baseTitle} — pagina ${page}` : baseTitle;
  const baseDescription = professionDistrictDescription(
    ref,
    count,
    countRecent(jobs),
  );
  const description = truncateMeta(
    page > 1 ? `Pagina ${page}. ${baseDescription}` : baseDescription,
    160,
  );
  const url = categoryPagePath(ref.path, page);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
      locale: "it_IT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function professionDistrictDescription(
  ref: CategoryRef,
  count: number,
  recent: number,
) {
  const n = count === 1 ? "1 offerta" : `${count} offerte`;
  const fresh =
    recent > 0
      ? ` ${recent} ${recent === 1 ? "nuova" : "nuove"} negli ultimi 7 giorni.`
      : "";
  if (ref.kind === "province" && ref.province) {
    return `${n} di lavoro nella sanità ${inProvincia(ref.province)} (${ref.district}), aggiornate oggi.${fresh} Ospedali, ASL, cliniche e RSA: crea avvisi gratuiti.`;
  }
  if (ref.kind === "combo" && ref.district) {
    return `${n} di ${ref.profession} ${inRegione(ref.district)}, aggiornate oggi.${fresh} Ospedali, cliniche e strutture accreditate: candidati sul sito della struttura.`;
  }
  if (ref.kind === "profession") {
    return `${n} di ${ref.profession} in Italia, aggiornate oggi.${fresh} Pubblico, privato e accreditato in un unico posto: filtra per regione.`;
  }
  return `${n} di lavoro nella sanità ${ref.district ? inRegione(ref.district) : "in Italia"}, aggiornate oggi.${fresh} Infermieri, medici, OSS, tecnici e altro: crea avvisi gratuiti.`;
}

/** `jobs` = offerte della pagina corrente. */
export function buildItemListJsonLd(ref: CategoryRef, jobs: Job[], page = 1) {
  const offset = (page - 1) * CATEGORY_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `${ref.title} — pagina ${page}` : ref.title,
    url: absoluteUrl(categoryPagePath(ref.path, page)),
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, CATEGORY_PAGE_SIZE).map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/offerte/${job.slug}`),
      name: job.title,
    })),
  };
}

export function relatedCategoryLinks(
  all: CategoryRef[],
  current: CategoryRef,
  limit = 6,
): CategoryRef[] {
  if (current.kind === "combo" && current.profession) {
    return all
      .filter(
        (item) =>
          item.kind === "combo" &&
          item.profession === current.profession &&
          item.path !== current.path,
      )
      .slice(0, limit);
  }
  if (current.kind === "profession") {
    return all
      .filter(
        (item) =>
          item.kind === "combo" && item.profession === current.profession,
      )
      .slice(0, limit);
  }
  if (current.kind === "district") {
    return all
      .filter(
        (item) => item.kind === "combo" && item.district === current.district,
      )
      .slice(0, limit);
  }
  return [];
}

export function siblingDistrictLinks(
  all: CategoryRef[],
  current: CategoryRef,
  limit = 6,
): CategoryRef[] {
  if (current.kind !== "combo" || !current.profession) return [];
  return all
    .filter(
      (item) =>
        item.kind === "combo" &&
        item.profession === current.profession &&
        item.path !== current.path,
    )
    .slice(0, limit);
}

/** "Per provincia": province della regione (landing di regione) o sorelle (landing di provincia). */
export function provinceLinks(
  all: CategoryRef[],
  current: CategoryRef,
  limit = 12,
): CategoryRef[] {
  if (current.kind !== "district" && current.kind !== "province") return [];
  return all
    .filter(
      (item) =>
        item.kind === "province" &&
        item.district === current.district &&
        item.path !== current.path,
    )
    .slice(0, limit);
}

/**
 * Destinazione di una landing senza offerte sufficienti: la landing madre idonea piu vicina
 * (professione, poi regione), altrimenti l'elenco generale. Mai /offerte?... perche' e'
 * bloccato nel robots.txt.
 */
export function fallbackCategoryPath(
  jobs: Parameters<typeof isCategoryEligible>[0],
  profession: string | null | undefined,
  district: string | null | undefined,
) {
  if (profession && district) {
    if (isCategoryEligible(jobs, profession, null)) return categoryPath(profession, null);
    if (isCategoryEligible(jobs, null, district)) return categoryPath(null, district);
  }
  return "/offerte";
}
