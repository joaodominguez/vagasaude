import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import { categoryPagePath } from "@/lib/categories";

/**
 * «Vagas de hoje» (/vagas/hoje): vagas que entraram no site nas últimas 48 h, paginadas, com ligação direta
 * a cada uma (descoberta por rastreio natural das vagas novas). Em PT todas as vagas de getJobs()
 * estão no jobs.xml, por isso a lista é a mesma do sitemap.
 */
export const RECENT_PATH = "/vagas/hoje";
export const RECENT_HOURS = 48;
/** Se houver poucas vagas nas últimas 48 h (scrapers parados), alarga a janela para 7 dias. */
const MIN_RECENT = 30;
const FALLBACK_HOURS = 7 * 24;
export const RECENT_PAGE_SIZE = 50;

export type RecentSet = { jobs: Job[]; hours: number };

/**
 * Quando a vaga entrou no site: a primeira vez que a vimos (firstSeenAt = createdAt), não a data da
 * fonte, que algumas fontes (net-empregos…) fazem avançar ao «republicar» anúncios antigos.
 * Sem firstSeenAt (dados de exemplo) cai para a data de publicação.
 */
export function entryTime(job: Pick<Job, "publishedAt" | "firstSeenAt">): number {
  const seen = job.firstSeenAt ? Date.parse(job.firstSeenAt) : Number.NaN;
  return Number.isNaN(seen) ? Date.parse(job.publishedAt) : seen;
}


export function listRecentJobs(jobs: Job[], now: number = Date.now()): RecentSet {
  const within = (hours: number) =>
    jobs.filter((job) => {
      const t = entryTime(job);
      return !Number.isNaN(t) && t <= now && now - t <= hours * 3_600_000;
    });
  let hours = RECENT_HOURS;
  let recent = within(hours);
  if (recent.length < MIN_RECENT) {
    hours = FALLBACK_HOURS;
    recent = within(hours);
  }
  recent.sort(
    (a, b) => entryTime(b) - entryTime(a) || a.title.localeCompare(b.title, "pt"),
  );
  return { jobs: recent, hours };
}

/** Espaço inseparável nos milhares («1 544»): o pt-PT do Intl não agrupa números de 4 dígitos. */
export function fmt(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function plural(n: number, one: string, many: string) {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function countTop(values: Array<string | null | undefined>, limit: number) {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .slice(0, limit);
}

export function windowLabel(hours: number) {
  return hours <= 48 ? "nas últimas 48 horas" : "nos últimos 7 dias";
}

export function recentTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / RECENT_PAGE_SIZE));
}

export function sliceRecentPage<T>(items: T[], page: number) {
  const start = (page - 1) * RECENT_PAGE_SIZE;
  return items.slice(start, start + RECENT_PAGE_SIZE);
}

export function recentHeading(set: RecentSet) {
  const n = fmt(set.jobs.length);
  return set.hours <= 48
    ? `Vagas de saúde de hoje: ${n} novas vagas`
    : `Vagas de saúde mais recentes: ${n} vagas dos últimos 7 dias`;
}

export function buildRecentIntro(set: RecentSet) {
  const { jobs, hours } = set;
  const n = jobs.length;
  const professions = countTop(
    jobs.map((job) => job.profession).filter((p) => p !== "Outros"),
    3,
  );
  const districts = countTop(jobs.map((job) => job.district), 3);
  const employers = countTop(jobs.map((job) => job.company), 3);
  const parts = [
    `${plural(n, "vaga de saúde foi publicada", "vagas de saúde foram publicadas")} ${windowLabel(hours)} em Portugal, ordenadas da mais recente para a mais antiga.`,
  ];
  if (professions.length > 0) {
    parts.push(
      `As áreas com mais ofertas são ${joinList(professions.map(([name, c]) => `${name.toLowerCase()} (${c})`))}.`,
    );
  }
  if (districts.length > 0) {
    parts.push(
      `Por distrito, destacam-se ${joinList(districts.map(([name, c]) => `${name} (${c})`))}.`,
    );
  }
  if (employers.length > 0) {
    parts.push(
      `Entre as entidades que mais publicaram estão ${joinList(employers.map(([name, c]) => `${name} (${c})`))}.`,
    );
  }
  parts.push("A lista é atualizada várias vezes por dia, a partir dos sites das próprias entidades.");
  return parts.join(" ");
}

export function buildRecentMetadata(set: RecentSet, page = 1): Metadata {
  const n = fmt(set.jobs.length);
  const baseTitle =
    set.hours <= 48
      ? `Vagas de saúde de hoje: ${n} novas vagas (últimas 48 h)`
      : `Vagas de saúde mais recentes: ${n} vagas (últimos 7 dias)`;
  const title = page > 1 ? `${baseTitle} — página ${page}` : baseTitle;
  const description = truncateMeta(
    `${plural(set.jobs.length, "vaga publicada", "vagas publicadas")} ${windowLabel(set.hours)}: enfermagem, medicina, farmácia, fisioterapia e mais, em hospitais e clínicas de todo o país. Candidata-te no site da entidade.`,
    160,
  );
  const url = categoryPagePath(RECENT_PATH, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_PT" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildRecentItemListJsonLd(set: RecentSet, pageJobs: Job[], page: number) {
  const offset = (page - 1) * RECENT_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `Vagas de saúde de hoje — página ${page}` : "Vagas de saúde de hoje",
    url: absoluteUrl(categoryPagePath(RECENT_PATH, page)),
    numberOfItems: pageJobs.length,
    itemListElement: pageJobs.map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/vagas/${job.slug}`),
      name: job.title,
    })),
  };
}
