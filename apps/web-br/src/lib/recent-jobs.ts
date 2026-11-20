import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { isSitemapJob } from "@/lib/indexable";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import { categoryPagePath } from "@/lib/categories";
import { countTop, joinList, plural } from "@/lib/landing-text";

/**
 * «Vagas de hoje» (/vagas/hoje): vagas que entraram no site nas últimas 48 h, paginadas, com ligação direta
 * a cada uma. É o caminho de descoberta por rastreio natural das vagas novas (o Googlebot chega
 * por aqui sem depender dos 200 envios/dia da Indexing API). Só entram vagas indexáveis
 * (as mesmas do jobs.xml): nenhum link para páginas noindex.
 */
export const RECENT_PATH = "/vagas/hoje";
export const RECENT_HOURS = 48;
/** Se houver poucas vagas nas últimas 48 h (fim de semana, scrapers parados), alarga a janela. */
const MIN_RECENT = 30;
const FALLBACK_HOURS = 7 * 24;
export const RECENT_PAGE_SIZE = 50;

export type RecentSet = { jobs: Job[]; hours: number };

/**
 * Quando a vaga entrou no site: o mais antigo entre a primeira vez que a vimos (firstSeenAt) e a data
 * da fonte. Não basta o createdAt: a recuperação de 17/11 recriou ~1500 vagas antigas com createdAt
 * recente; e a data da fonte sozinha avança quando a fonte «republica» o anúncio.
 */
export function entryTime(job: Pick<Job, "publishedAt" | "firstSeenAt">): number {
  const times = [job.publishedAt, job.firstSeenAt]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length ? Math.min(...times) : Number.NaN;
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
  // `jobs` já vem ordenado por publicação (mais recente primeiro); garantir a ordem.
  recent.sort((a, b) => entryTime(b) - entryTime(a) || a.title.localeCompare(b.title, "pt"));
  return { jobs: recent, hours };
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
  const n = set.jobs.length;
  return set.hours <= 48
    ? `Vagas de saúde de hoje: ${n.toLocaleString("pt-BR")} novas vagas`
    : `Vagas de saúde mais recentes: ${n.toLocaleString("pt-BR")} vagas dos últimos 7 dias`;
}

export function buildRecentIntro(set: RecentSet) {
  const { jobs, hours } = set;
  const n = jobs.length;
  const professions = countTop(
    jobs.map((job) => job.profession).filter((p) => p !== "Outros"),
    3,
  );
  const states = countTop(jobs.map((job) => job.district), 3);
  const employers = countTop(jobs.map((job) => job.company), 3);
  const parts = [
    `${plural(n, "vaga de saúde foi publicada", "vagas de saúde foram publicadas")} ${windowLabel(hours)} no Brasil, ordenadas da mais recente para a mais antiga.`,
  ];
  if (professions.length > 0) {
    parts.push(
      `As áreas com mais ofertas são ${joinList(professions.map(([name, c]) => `${name.toLowerCase()} (${c})`))}.`,
    );
  }
  if (states.length > 0) {
    parts.push(
      `Por estado, destacam-se ${joinList(states.map(([name, c]) => `${name} (${c})`))}.`,
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
  const n = set.jobs.length;
  const baseTitle =
    set.hours <= 48
      ? `Vagas de saúde de hoje: ${n.toLocaleString("pt-BR")} novas vagas (últimas 48 h)`
      : `Vagas de saúde mais recentes: ${n.toLocaleString("pt-BR")} vagas (últimos 7 dias)`;
  const title = page > 1 ? `${baseTitle} — página ${page}` : baseTitle;
  const description = truncateMeta(
    `${plural(n, "vaga publicada", "vagas publicadas")} ${windowLabel(set.hours)}: enfermagem, medicina, farmácia, fisioterapia e mais, de hospitais e clínicas de todo o Brasil. Candidate-se no site da entidade.`,
    160,
  );
  const url = categoryPagePath(RECENT_PATH, page);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_BR" },
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
