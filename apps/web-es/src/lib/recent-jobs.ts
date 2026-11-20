import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { categoryPagePath } from "@/lib/categories";
import { GENERIC_COMPANY_RE } from "@/lib/job-display";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import { isSitemapJob } from "@/lib/sitemap-jobs";

/**
 * «Ofertas de hoy» (/empleo/hoy): ofertas publicadas en las últimas 48 h, paginadas, con enlace directo a
 * cada una. Es el camino de descubrimiento por rastreo natural de las ofertas nuevas (Googlebot llega por
 * aquí sin depender de los 200 envíos/día de la Indexing API). Solo entran ofertas indexables (las mismas
 * del jobs.xml): ningún enlace a páginas noindex.
 */
export const RECENT_PATH = "/empleo/hoy";
export const RECENT_HOURS = 48;
/** Si hay pocas ofertas en las últimas 48 h (fin de semana, scrapers parados), se amplía la ventana. */
const MIN_RECENT = 30;
const FALLBACK_HOURS = 7 * 24;
export const RECENT_PAGE_SIZE = 50;

export type RecentSet = { jobs: Job[]; hours: number };

export function listRecentJobs(jobs: Job[], now: number = Date.now()): RecentSet {
  const indexable = jobs.filter((job) => isSitemapJob(job, now));
  const within = (hours: number) =>
    indexable.filter((job) => {
      const t = Date.parse(job.publishedAt);
      return !Number.isNaN(t) && t <= now && now - t <= hours * 3_600_000;
    });
  let hours = RECENT_HOURS;
  let recent = within(hours);
  if (recent.length < MIN_RECENT) {
    hours = FALLBACK_HOURS;
    recent = within(hours);
  }
  recent.sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title, "es"),
  );
  return { jobs: recent, hours };
}

const nf = new Intl.NumberFormat("es-ES");

function windowLabel(hours: number) {
  return hours <= 48 ? "en las últimas 48 horas" : "en los últimos 7 días";
}

export function recentTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / RECENT_PAGE_SIZE));
}

export function sliceRecentPage<T>(items: T[], page: number) {
  const start = (page - 1) * RECENT_PAGE_SIZE;
  return items.slice(start, start + RECENT_PAGE_SIZE);
}

export function recentHeading(set: RecentSet) {
  const n = nf.format(set.jobs.length);
  return set.hours <= 48
    ? `Ofertas de hoy: ${n} ofertas sanitarias nuevas`
    : `Ofertas más recientes: ${n} ofertas de los últimos 7 días`;
}

function countTop(values: string[], limit: number): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit);
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function buildRecentIntro(set: RecentSet) {
  const { jobs, hours } = set;
  const n = jobs.length;
  const professions = countTop(
    jobs.map((job) => job.profession).filter((p) => p !== "Otros"),
    3,
  );
  const regions = countTop(jobs.map((job) => job.district), 3);
  const employers = countTop(
    jobs.map((job) => job.company).filter((name) => !GENERIC_COMPANY_RE.test(name)),
    3,
  );
  const parts = [
    `${n === 1 ? "Se ha publicado 1 oferta sanitaria" : `Se han publicado ${nf.format(n)} ofertas sanitarias`} ${windowLabel(hours)} en España, ordenadas de la más reciente a la más antigua.`,
  ];
  if (professions.length > 0) {
    parts.push(
      `Las áreas con más ofertas son ${joinList(professions.map(([name, c]) => `${name.toLowerCase()} (${c})`))}.`,
    );
  }
  if (regions.length > 0) {
    parts.push(
      `Por comunidad destacan ${joinList(regions.map(([name, c]) => `${name} (${c})`))}.`,
    );
  }
  if (employers.length > 0) {
    parts.push(
      `Entre las entidades que más han publicado están ${joinList(employers.map(([name, c]) => `${name} (${c})`))}.`,
    );
  }
  parts.push("La lista se actualiza varias veces al día a partir de las webs de las propias entidades.");
  return parts.join(" ");
}

export function buildRecentMetadata(set: RecentSet, page = 1): Metadata {
  const n = nf.format(set.jobs.length);
  const baseTitle =
    set.hours <= 48
      ? `Ofertas de empleo sanitario de hoy: ${n} nuevas (últimas 48 h)`
      : `Ofertas de empleo sanitario más recientes: ${n} (últimos 7 días)`;
  const title = page > 1 ? `${baseTitle} — página ${page}` : baseTitle;
  const description = truncateMeta(
    `${n} ofertas publicadas ${windowLabel(set.hours)}: enfermería, medicina, TCAE, fisioterapia, farmacia y más, de hospitales, residencias y clínicas de toda España. Inscríbete en la web de la entidad.`,
    160,
  );
  const url = categoryPagePath(RECENT_PATH, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "es_ES" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildRecentItemListJsonLd(pageJobs: Job[], page: number) {
  const offset = (page - 1) * RECENT_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `Ofertas de hoy — página ${page}` : "Ofertas de hoy",
    url: absoluteUrl(categoryPagePath(RECENT_PATH, page)),
    numberOfItems: pageJobs.length,
    itemListElement: pageJobs.map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/empleo/${job.slug}`),
      name: job.title,
    })),
  };
}
