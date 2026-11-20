import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import {
  categoryPagePath,
  filterJobsForCategory,
  toCategorySlug,
} from "@/lib/categories";
import { cityOfJob, getCityIndex, stateUf, type CityRef } from "@/lib/cities";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import { buildLocalIntro, countTop, joinList } from "@/lib/landing-text";

/**
 * Landings profissão × cidade: /vagas/<estado>/<cidade>/<profissao>
 * (ex.: /vagas/sao-paulo/sao-paulo/tecnico-de-enfermagem). Só existem para profissões clínicas e
 * combinações com volume real (≥ LOCAL_MIN_JOBS vagas ativas); abaixo disso o proxy redireciona
 * para a landing da cidade (ver lib/local-redirect.ts) e a página responde 404 como rede de segurança.
 */
export const LOCAL_MIN_JOBS = 8;

/** Profissões com landing por cidade (as outras — Outros, Administrativo… — não têm procura própria). */
export const LOCAL_PROFESSIONS = [
  "Enfermagem",
  "Técnico de Enfermagem",
  "Auxiliar de Enfermagem",
  "Enfermeiro",
  "Medicina",
  "Farmácia",
  "Fisioterapia",
  "Técnico de Saúde",
  "Auxiliares",
  "Psicologia",
  "Nutrição",
] as const;

const PROFESSION_BY_SLUG = new Map<string, string>(
  LOCAL_PROFESSIONS.map((label) => [toCategorySlug(label), label] as const),
);

export function localProfessionFromSlug(slug: string) {
  return PROFESSION_BY_SLUG.get(slug) ?? null;
}

export type LocalRef = {
  city: CityRef;
  profession: string;
  path: string;
  title: string;
  h1: string;
  jobs: Job[];
};

type LocalIndex = {
  all: LocalRef[];
  byKey: Map<string, LocalRef>;
};

const indexCache = new WeakMap<Job[], LocalIndex>();

export function localPath(city: CityRef, profession: string) {
  return `${city.path}/${toCategorySlug(profession)}`;
}

export function getLocalIndex(jobs: Job[]): LocalIndex {
  const cached = indexCache.get(jobs);
  if (cached) return cached;
  const all: LocalRef[] = [];
  for (const city of getCityIndex(jobs).all) {
    if (city.jobs.length < LOCAL_MIN_JOBS) continue;
    for (const profession of LOCAL_PROFESSIONS) {
      const subset = filterJobsForCategory(city.jobs, profession, null);
      if (subset.length < LOCAL_MIN_JOBS) continue;
      const title = `Vagas de ${profession} em ${city.name} (${city.uf})`;
      all.push({
        city,
        profession,
        path: localPath(city, profession),
        title,
        h1: `${title} — ${subset.length} ${subset.length === 1 ? "vaga" : "vagas"}`,
        jobs: subset,
      });
    }
  }
  all.sort((a, b) => b.jobs.length - a.jobs.length || a.path.localeCompare(b.path, "pt"));
  const index = { all, byKey: new Map(all.map((ref) => [ref.path, ref] as const)) };
  indexCache.set(jobs, index);
  return index;
}

export function listEligibleLocals(jobs: Job[]) {
  return getLocalIndex(jobs).all;
}

/** Landing profissão × cidade para os três segmentos da URL, ou null (inexistente ou abaixo do mínimo). */
export function resolveLocal(jobs: Job[], state: string, city: string, professionSlug: string) {
  return getLocalIndex(jobs).byKey.get(`/vagas/${state}/${city}/${professionSlug}`) ?? null;
}

/** Outras cidades do estado com a mesma profissão, e outras profissões na mesma cidade. */
export function localNeighbors(jobs: Job[], ref: LocalRef, limit = 8) {
  const all = getLocalIndex(jobs).all;
  const sameProfession = all
    .filter(
      (item) =>
        item.profession === ref.profession &&
        item.city.district === ref.city.district &&
        item.path !== ref.path,
    )
    .slice(0, limit);
  const sameCity = all
    .filter((item) => item.city.path === ref.city.path && item.path !== ref.path)
    .slice(0, limit);
  return { sameProfession, sameCity };
}

export function buildLocalIntroText(jobs: Job[], ref: LocalRef) {
  const neighbors = localNeighbors(jobs, ref, 3).sameProfession;
  const extra =
    neighbors.length > 0
      ? `Em ${ref.city.district}, há também vagas de ${ref.profession.toLowerCase()} em ${joinList(neighbors.map((n) => `${n.city.name} (${n.jobs.length})`))}.`
      : null;
  const otherProfessions = countTop(
    ref.city.jobs
      .filter((job) => job.profession !== "Outros")
      .map((job) => job.profession),
    3,
  );
  const mix =
    otherProfessions.length > 0
      ? `No total, ${ref.city.name} tem ${ref.city.jobs.length.toLocaleString("pt-BR")} vagas de saúde, sobretudo em ${joinList(otherProfessions.map(([name]) => name.toLowerCase()))}.`
      : null;
  return buildLocalIntro({
    what: ref.profession,
    where: `${ref.city.name} (${ref.city.uf})`,
    jobs: ref.jobs,
    seed: ref.path,
    extra: [extra, mix].filter(Boolean).join(" ") || null,
  });
}

export function buildLocalMetadata(ref: LocalRef, page = 1): Metadata {
  const n = ref.jobs.length;
  const baseTitle = `Vagas de ${ref.profession} em ${ref.city.name} (${ref.city.uf}): ${n} ${n === 1 ? "vaga" : "vagas"}`;
  const title = page > 1 ? `${baseTitle} — página ${page}` : baseTitle;
  const employers = countTop(ref.jobs.map((job) => job.company), 2).map(([name]) => name);
  const description = truncateMeta(
    `${n} ${n === 1 ? "vaga" : "vagas"} de ${ref.profession} em ${ref.city.name}, ${ref.city.uf}${employers.length ? `: ${joinList(employers)} e outras entidades` : ""}. Veja as ofertas atualizadas e candidate-se direto no site da entidade.`,
    160,
  );
  const url = categoryPagePath(ref.path, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_BR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildLocalItemListJsonLd(ref: LocalRef, pageJobs: Job[], page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
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

/** Intro das landings profissão × estado, com os mesmos dados reais (cidades do estado incluídas). */
export function buildComboIntroText(jobs: Job[], profession: string, district: string, path: string) {
  const cities = countTop(
    jobs.map((job) => cityOfJob(job)?.name),
    4,
  );
  const uf = stateUf(district);
  return buildLocalIntro({
    what: profession,
    where: uf ? `${district} (${uf})` : district,
    jobs,
    seed: path,
    extra:
      cities.length > 1
        ? `Por cidade, destacam-se ${joinList(cities.map(([name, count]) => `${name} (${count})`))}.`
        : null,
  });
}
