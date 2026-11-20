import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { isSitemapJob } from "@/lib/indexable";
import { categoryPagePath } from "@/lib/categories";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/**
 * «Offerte di oggi» (/offerte/oggi): offerte entrate nel sito nelle ultime 48 h, paginate, con link diretto
 * a ciascuna. È il percorso di scoperta per crawling naturale delle offerte nuove (Googlebot arriva
 * da qui senza dipendere dai 200 invii/giorno della Indexing API). Entrano solo le offerte del
 * jobs.xml (stesso criterio): nessun link a pagine noindex o in scadenza.
 */
export const RECENT_PATH = "/offerte/oggi";
export const RECENT_HOURS = 48;
/**
 * In Italia le offerte nuove sono poche al giorno (~20-30, con calo nel weekend): sotto MIN_RECENT
 * nelle ultime 48 h la finestra passa a 7 giorni (e a 30 giorni se perfino quella è quasi vuota).
 */
const MIN_RECENT = 25;
const FALLBACK_HOURS = 7 * 24;
const LAST_RESORT_HOURS = 30 * 24;
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
  const indexable = jobs.filter((job) => isSitemapJob(job, now));
  const within = (hours: number) =>
    indexable.filter((job) => {
      const t = entryTime(job);
      return !Number.isNaN(t) && t <= now && now - t <= hours * 3_600_000;
    });
  let hours = RECENT_HOURS;
  let recent = within(hours);
  if (recent.length < MIN_RECENT) {
    hours = FALLBACK_HOURS;
    recent = within(hours);
  }
  if (recent.length < MIN_RECENT) {
    hours = LAST_RESORT_HOURS;
    recent = within(hours);
  }
  recent.sort(
    (a, b) => entryTime(b) - entryTime(a) || a.title.localeCompare(b.title, "it"),
  );
  return { jobs: recent, hours };
}

const nf = new Intl.NumberFormat("it-IT");

export function windowLabel(hours: number) {
  if (hours <= 48) return "nelle ultime 48 ore";
  return hours <= 7 * 24 ? "negli ultimi 7 giorni" : "negli ultimi 30 giorni";
}

function windowShort(hours: number) {
  if (hours <= 48) return "";
  return hours <= 7 * 24 ? "degli ultimi 7 giorni" : "degli ultimi 30 giorni";
}

export function recentTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / RECENT_PAGE_SIZE));
}

export function sliceRecentPage<T>(items: T[], page: number) {
  const start = (page - 1) * RECENT_PAGE_SIZE;
  return items.slice(start, start + RECENT_PAGE_SIZE);
}

/** Etichetta del link verso la pagina (home): «Vedi le 120 offerte di oggi». */
export function recentLinkLabel(set: RecentSet) {
  return set.hours <= 48
    ? `Vedi le ${nf.format(set.jobs.length)} offerte di oggi`
    : `Vedi le ${nf.format(set.jobs.length)} offerte più recenti`;
}

export function recentHeading(set: RecentSet) {
  const n = nf.format(set.jobs.length);
  return set.hours <= 48
    ? `Offerte di oggi: ${n} nuove offerte di lavoro nella sanità`
    : `Offerte più recenti: ${n} offerte di lavoro nella sanità ${windowShort(set.hours)}`;
}

function countTop(values: string[], limit: number): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"))
    .slice(0, limit);
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function buildRecentIntro(set: RecentSet) {
  const { jobs, hours } = set;
  const n = jobs.length;
  const professions = countTop(
    jobs.map((job) => job.profession).filter((p) => p && p !== "Altro"),
    3,
  );
  const regions = countTop(jobs.map((job) => job.district), 3);
  const employers = countTop(jobs.map((job) => job.company), 3);
  const parts = [
    `${n === 1 ? "1 offerta è stata pubblicata" : `${nf.format(n)} offerte sono state pubblicate`} ${windowLabel(hours)} in Italia, dalla più recente alla meno recente.`,
  ];
  if (professions.length > 0) {
    parts.push(
      `Le figure più richieste sono ${joinList(professions.map(([name, c]) => `${name.toLowerCase()} (${c})`))}.`,
    );
  }
  if (regions.length > 0) {
    parts.push(`Per regione spiccano ${joinList(regions.map(([name, c]) => `${name} (${c})`))}.`);
  }
  if (employers.length > 0) {
    parts.push(
      `Tra gli enti che hanno pubblicato di più ci sono ${joinList(employers.map(([name, c]) => `${name} (${c})`))}.`,
    );
  }
  parts.push("L'elenco si aggiorna più volte al giorno, a partire dai siti degli enti stessi.");
  return parts.join(" ");
}

export function buildRecentMetadata(set: RecentSet, page = 1): Metadata {
  const n = nf.format(set.jobs.length);
  const baseTitle =
    set.hours <= 48
      ? `Offerte di oggi: ${n} nuove offerte nella sanità`
      : `Offerte più recenti: ${n} offerte nella sanità`;
  const title = page > 1 ? `${baseTitle} — pagina ${page}` : baseTitle;
  const description = truncateMeta(
    `${n} ${set.jobs.length === 1 ? "offerta pubblicata" : "offerte pubblicate"} ${windowLabel(set.hours)}: infermieri, medici, OSS, fisioterapisti e altre professioni sanitarie, da ASL, ospedali e strutture private di tutta Italia. Candidati sul sito dell'ente.`,
    160,
  );
  const url = categoryPagePath(RECENT_PATH, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildRecentItemListJsonLd(set: RecentSet, pageJobs: Job[], page: number) {
  const offset = (page - 1) * RECENT_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page > 1 ? `Offerte di oggi — pagina ${page}` : "Offerte di oggi",
    url: absoluteUrl(categoryPagePath(RECENT_PATH, page)),
    numberOfItems: pageJobs.length,
    itemListElement: pageJobs.map((job, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      url: absoluteUrl(`/offerte/${job.slug}`),
      name: job.title,
    })),
  };
}
