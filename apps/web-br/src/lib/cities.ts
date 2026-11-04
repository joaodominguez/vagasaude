import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { BRAZIL_STATES } from "@/lib/brazil-states";
import {
  CATEGORY_MIN_JOBS,
  categoryPagePath,
  districtFromSlug,
  isKnownDistrict,
  toCategorySlug,
} from "@/lib/categories";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/**
 * Landings de cidade: /vagas/<estado>/<cidade>. O primeiro segmento é sempre
 * um estado, por isso não colide com /vagas/<profissão>/<estado> nem com as
 * vagas (/vagas/<slug>, um só segmento). Só existem com ≥ CATEGORY_MIN_JOBS vagas.
 */

const UF_BY_STATE = new Map<string, string>(
  BRAZIL_STATES.map((s) => [s.name, s.uf] as const),
);
const STATE_BY_UF = new Map<string, string>(
  BRAZIL_STATES.map((s) => [s.uf, s.name] as const),
);
const STATE_SLUGS = new Set(
  BRAZIL_STATES.map((s) => toCategorySlug(s.name)),
);

export function stateUf(district: string) {
  return UF_BY_STATE.get(district) ?? null;
}

/** Cidades com o mesmo nome do estado: só São Paulo/SP e Rio de Janeiro/RJ são municípios reais. */
const SAME_NAME_AS_STATE = new Set(["São Paulo", "Rio de Janeiro"]);

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);

function titleCaseCity(text: string) {
  return text
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) =>
      index > 0 && LOWER_WORDS.has(word)
        ? word
        : word.replace(/(^|-)(\p{L})/gu, (_m, sep: string, ch: string) =>
            sep + ch.toLocaleUpperCase("pt-BR"),
          ),
    )
    .join(" ");
}

const BAD_CITY_RE =
  /\d|remot|home ?office|todo(s)? (o )?brasil|vari[aá]|diversas|nacional|brasil|h[ií]brido|presencial/i;

/**
 * Nome de cidade normalizado (sem sufixo de UF, capitalização uniforme), ou null
 * se o valor não for um município plausível do estado da vaga.
 */
export function normalizeCityName(raw: string, district: string): string | null {
  const uf = UF_BY_STATE.get(district);
  if (!uf) return null;
  let name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > 40) return null;

  const suffix = name.match(/^(.*?)\s*(?:[-/,]\s*|\(\s*)([A-Za-z]{2})\s*\)?$/);
  if (suffix && STATE_BY_UF.has(suffix[2].toUpperCase())) {
    if (suffix[2].toUpperCase() !== uf) return null;
    name = suffix[1].trim();
  }
  if (!name || BAD_CITY_RE.test(name)) return null;

  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return null;
  if (name === name.toLocaleUpperCase("pt-BR") || name === name.toLocaleLowerCase("pt-BR")) {
    name = titleCaseCity(name);
  }
  if (isKnownDistrict(name) && !(SAME_NAME_AS_STATE.has(name) && name === district)) {
    return null;
  }
  return name;
}

const cityByJob = new WeakMap<Job, { district: string; name: string; slug: string } | null>();

/** Cidade validada da vaga (cidade ≠ estado, coerente com a UF), ou null. */
export function cityOfJob(job: Job) {
  if (cityByJob.has(job)) return cityByJob.get(job) ?? null;
  let result: { district: string; name: string; slug: string } | null = null;
  if (job.city && job.district && isKnownDistrict(job.district) && job.city !== job.district) {
    const name = normalizeCityName(job.city, job.district);
    if (name) result = { district: job.district, name, slug: toCategorySlug(name) };
  } else if (job.city === job.district && SAME_NAME_AS_STATE.has(job.city)) {
    result = { district: job.district, name: job.city, slug: toCategorySlug(job.city) };
  }
  cityByJob.set(job, result);
  return result;
}

export function cityPath(district: string, citySlug: string) {
  return `/vagas/${toCategorySlug(district)}/${citySlug}`;
}

export type CityRef = {
  district: string;
  uf: string;
  name: string;
  slug: string;
  path: string;
  title: string;
  jobs: Job[];
};

type CityIndex = {
  all: CityRef[];
  byKey: Map<string, CityRef>;
  byDistrict: Map<string, CityRef[]>;
};

const indexCache = new WeakMap<Job[], CityIndex>();

/** Todas as cidades com ≥ CATEGORY_MIN_JOBS vagas (índice em cache por lista de vagas). */
export function getCityIndex(jobs: Job[]): CityIndex {
  const cached = indexCache.get(jobs);
  if (cached) return cached;

  const groups = new Map<string, { district: string; slug: string; names: Map<string, number>; jobs: Job[] }>();
  for (const job of jobs) {
    const city = cityOfJob(job);
    if (!city) continue;
    const key = `${toCategorySlug(city.district)}/${city.slug}`;
    let group = groups.get(key);
    if (!group) {
      group = { district: city.district, slug: city.slug, names: new Map(), jobs: [] };
      groups.set(key, group);
    }
    group.names.set(city.name, (group.names.get(city.name) ?? 0) + 1);
    group.jobs.push(job);
  }

  const all: CityRef[] = [];
  for (const [key, group] of groups) {
    if (group.jobs.length < CATEGORY_MIN_JOBS) continue;
    const name = [...group.names.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"),
    )[0][0];
    const uf = UF_BY_STATE.get(group.district)!;
    all.push({
      district: group.district,
      uf,
      name,
      slug: group.slug,
      path: `/vagas/${key}`,
      title: `Vagas de saúde em ${name} (${uf})`,
      jobs: group.jobs,
    });
  }
  all.sort((a, b) => b.jobs.length - a.jobs.length || a.path.localeCompare(b.path, "pt"));

  const byKey = new Map(all.map((c) => [`${toCategorySlug(c.district)}/${c.slug}`, c] as const));
  const byDistrict = new Map<string, CityRef[]>();
  for (const city of all) {
    const list = byDistrict.get(city.district) ?? [];
    list.push(city);
    byDistrict.set(city.district, list);
  }
  const index = { all, byKey, byDistrict };
  indexCache.set(jobs, index);
  return index;
}

export function listEligibleCities(jobs: Job[]) {
  return getCityIndex(jobs).all;
}

/** Cidade elegível para os dois segmentos da URL, ou null. */
export function resolveCity(jobs: Job[], stateSlug: string, citySlug: string) {
  if (!STATE_SLUGS.has(stateSlug) || !districtFromSlug(stateSlug)) return null;
  return getCityIndex(jobs).byKey.get(`${stateSlug}/${citySlug}`) ?? null;
}

/** Landing de cidade da vaga, se existir. */
export function cityRefOfJob(jobs: Job[], job: Job) {
  const city = cityOfJob(job);
  if (!city) return null;
  return getCityIndex(jobs).byKey.get(`${toCategorySlug(city.district)}/${city.slug}`) ?? null;
}

export function citiesOfDistrict(jobs: Job[], district: string) {
  return getCityIndex(jobs).byDistrict.get(district) ?? [];
}

export function buildCityIntro(city: CityRef) {
  const counts = (values: string[], limit: number) => {
    const map = new Map<string, number>();
    for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
      .slice(0, limit);
  };
  const n = city.jobs.length;
  const professions = counts(city.jobs.map((j) => j.profession).filter((p) => p !== "Outros"), 3)
    .map(([name]) => name.toLowerCase())
    .join(", ");
  const employers = counts(city.jobs.map((j) => j.company), 3)
    .map(([name]) => name)
    .join(", ");
  return [
    `Aqui você encontra ${n === 1 ? "1 vaga" : `${n} vagas`} de saúde em ${city.name} (${city.uf}), reunidas dos sites de hospitais, clínicas, laboratórios e órgãos públicos.`,
    professions && `As áreas com mais ofertas são ${professions}.`,
    employers && `Entre as entidades que estão contratando destacam-se ${employers}.`,
    "Você se candidata diretamente no site da entidade ou cria um alerta para receber novas vagas por email.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCityMetadata(city: CityRef, page = 1): Metadata {
  const n = city.jobs.length;
  const offerWord = n === 1 ? "oferta ativa" : "ofertas ativas";
  const baseTitle = `Vagas de saúde em ${city.name} (${city.uf}): ${n} ${offerWord}`;
  const title = page > 1 ? `${baseTitle} — página ${page}` : baseTitle;
  const description = truncateMeta(
    `${n === 1 ? "1 vaga" : `${n} vagas`} de saúde em ${city.name}, ${city.uf}. Enfermagem, medicina, técnicos e outras profissões em hospitais e clínicas — candidate-se no site da entidade.`,
    160,
  );
  const url = categoryPagePath(city.path, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_BR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildCityItemListJsonLd(city: CityRef, pageJobs: Job[], page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `${city.title} — página ${page}` : city.title,
    url: absoluteUrl(categoryPagePath(city.path, page)),
    numberOfItems: pageJobs.length,
    itemListElement: pageJobs.map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/vagas/${job.slug}`),
      name: job.title,
    })),
  };
}
