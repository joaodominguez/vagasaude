import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import {
  CATEGORY_MIN_JOBS,
  CATEGORY_PAGE_SIZE,
  categoryPagePath,
  districtFromSlug,
  isKnownDistrict,
  toCategorySlug,
} from "@/lib/categories";
import { CONCELHOS_BY_DISTRICT, CONCELHO_ALIASES } from "@/lib/concelhos-data";
import { emLocal } from "@/lib/pt-locative";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/**
 * Landings de concelho: /vagas/concelho/<distrito>/<concelho>.
 *
 * `/vagas/<a>/<b>` já é profissão × distrito e `/vagas/<slug>` também serve
 * vagas, categorias e `/vagas/<a>/<b>/<c>` é a paginação. O segmento estático
 * `concelho` tem prioridade sobre os dinâmicos, não colide com nenhum URL
 * existente e inclui sempre o distrito (há concelhos homónimos: Lagoa em Faro
 * e nos Açores, Calheta nos Açores e na Madeira).
 */
export const CONCELHO_ROUTE = "/vagas/concelho";

export function normalizeKey(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function concelhoPath(district: string, concelho: string) {
  return `${CONCELHO_ROUTE}/${toCategorySlug(district)}/${toCategorySlug(concelho)}`;
}

export type ConcelhoRef = {
  district: string;
  concelho: string;
  path: string;
  title: string;
};

// district|chave normalizada → nome oficial do concelho
const BY_KEY = new Map<string, string>();
// district|slug → nome oficial
const BY_SLUG = new Map<string, string>();
for (const [district, list] of Object.entries(CONCELHOS_BY_DISTRICT)) {
  for (const concelho of list) {
    BY_KEY.set(`${district}|${normalizeKey(concelho)}`, concelho);
    BY_SLUG.set(`${district}|${toCategorySlug(concelho)}`, concelho);
  }
}

/** Concelho a partir dos slugs do URL (null se o distrito/concelho não existem). */
export function resolveConcelhoSegments(districtSlug: string, concelhoSlug: string) {
  const district = districtFromSlug(districtSlug);
  if (!district) return null;
  const concelho = BY_SLUG.get(`${district}|${concelhoSlug}`);
  if (!concelho) return null;
  return buildRef(district, concelho);
}

function buildRef(district: string, concelho: string): ConcelhoRef {
  return {
    district,
    concelho,
    path: concelhoPath(district, concelho),
    title: concelhoHeading(concelho),
  };
}

export function concelhoHeading(concelho: string) {
  return `Emprego na saúde ${emLocal(concelho)}`;
}

/**
 * Concelho de uma vaga a partir de `city` (= locationConcelho || distrito),
 * validado contra o distrito da vaga: aceita nome oficial, grafias sem
 * acentos/abreviadas e freguesias conhecidas; ignora "Portugal", nomes de
 * serviços e concelhos que pertencem a outro distrito (dados mal preenchidos).
 */
export function concelhoOfJob(
  job: Pick<Job, "city" | "district" | "concelho">,
): string | null {
  const district = job.district;
  if (!district || !CONCELHOS_BY_DISTRICT[district]) return null;
  // `city` cai para o distrito quando não há concelho: sem `concelho` não há nada a resolver.
  const raw = job.concelho !== undefined ? job.concelho : job.city;
  if (!raw) return null;
  const candidates = [raw, ...raw.split(/[,;()/|–—]/)];
  for (const candidate of candidates) {
    const key = normalizeKey(candidate);
    if (!key) continue;
    const official = BY_KEY.get(`${district}|${key}`);
    if (official) return official;
    const alias = CONCELHO_ALIASES[key];
    if (alias && alias.district === district) return alias.concelho;
  }
  return null;
}

const concelhoCache = new WeakMap<object, string | null>();

/** Igual a concelhoOfJob, memoizado por objeto. */
export function jobConcelho(job: Job): string | null {
  const cached = concelhoCache.get(job);
  if (cached !== undefined) return cached;
  const value = concelhoOfJob(job);
  concelhoCache.set(job, value);
  return value;
}

export function filterJobsForConcelho(jobs: Job[], district: string, concelho: string) {
  return jobs.filter(
    (job) => job.district === district && jobConcelho(job) === concelho,
  );
}

export type EligibleConcelho = ConcelhoRef & { count: number };

const eligibleCache = new WeakMap<Job[], EligibleConcelho[]>();

/** Concelhos com landing: ≥ CATEGORY_MIN_JOBS vagas ativas, por volume. */
export function listEligibleConcelhos(jobs: Job[]): EligibleConcelho[] {
  const cached = eligibleCache.get(jobs);
  if (cached) return cached;
  const counts = new Map<string, EligibleConcelho>();
  for (const job of jobs) {
    if (!isKnownDistrict(job.district)) continue;
    const concelho = jobConcelho(job);
    if (!concelho) continue;
    const key = `${job.district}|${concelho}`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { ...buildRef(job.district, concelho), count: 1 });
  }
  const list = [...counts.values()]
    .filter((item) => item.count >= CATEGORY_MIN_JOBS)
    .sort(
      (a, b) =>
        b.count - a.count || a.concelho.localeCompare(b.concelho, "pt"),
    );
  eligibleCache.set(jobs, list);
  return list;
}

export function isConcelhoEligible(jobs: Job[], district: string, concelho: string) {
  return listEligibleConcelhos(jobs).some(
    (item) => item.district === district && item.concelho === concelho,
  );
}

export function concelhoTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / CATEGORY_PAGE_SIZE));
}

export function buildConcelhoIntro(
  ref: ConcelhoRef,
  jobs: Job[],
) {
  const countBy = (values: string[], limit: number) => {
    const map = new Map<string, number>();
    for (const value of values) {
      const key = value.trim();
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
      .slice(0, limit);
  };
  const companies = countBy(jobs.map((job) => job.company), 3).map(([name]) => name);
  const sectors = countBy(jobs.map((job) => job.sector), 3).map(
    ([name, n]) => `${n} no setor ${name.toLowerCase()}`,
  );
  const professions = countBy(jobs.map((job) => job.profession), 3).map(([name]) =>
    name.toLowerCase(),
  );
  const where = emLocal(ref.concelho);
  return [
    `Aqui encontras vagas de saúde ${where} (distrito de ${ref.district}), agregadas de hospitais, clínicas, laboratórios e outras entidades.`,
    `Neste momento há ${jobs.length} ${jobs.length === 1 ? "oferta ativa" : "ofertas ativas"}${sectors.length ? `: ${sectors.join(", ")}` : ""}.`,
    companies.length
      ? `Entre as entidades que estão a recrutar destacam-se ${companies.join(", ")}.`
      : "",
    professions.length ? `As áreas com mais vagas são ${professions.join(", ")}.` : "",
    "A candidatura é feita diretamente no site da entidade; podes também criar um alerta para receber novas vagas por email.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildConcelhoMetadata(
  ref: ConcelhoRef,
  count: number,
  page = 1,
): Metadata {
  const vagas = count === 1 ? "1 vaga" : `${count} vagas`;
  const base = `Emprego na saúde ${emLocal(ref.concelho)}: ${vagas}`;
  const title = page > 1 ? `${base} — página ${page}` : base;
  const baseDescription = `${vagas} de saúde ${emLocal(ref.concelho)} (${ref.district}), atualizadas hoje. Enfermagem, medicina, técnicos e mais — candidata-te no site da entidade.`;
  const description = truncateMeta(
    page > 1 ? `Página ${page}. ${baseDescription}` : baseDescription,
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
      locale: "pt_PT",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildConcelhoItemListJsonLd(ref: ConcelhoRef, pageJobs: Job[], page = 1) {
  const offset = (page - 1) * CATEGORY_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `${ref.title} — página ${page}` : ref.title,
    url: absoluteUrl(categoryPagePath(ref.path, page)),
    numberOfItems: pageJobs.length,
    itemListElement: pageJobs.map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/vagas/${job.slug}`),
      name: job.title,
    })),
  };
}
