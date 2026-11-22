import { isConcursoJob } from "@/lib/concursos";
import { isClinicalJob, isSitemapJob } from "@/lib/indexable";
import type { Job } from "@/lib/jobs";
import { getJobs } from "@/lib/jobs-data";
import { getJobCard } from "@/lib/job-store";
import { pickLastmod } from "@/lib/lastmod";

/**
 * Vagas que entram no jobs.xml — e, por arrasto, na Indexing API e no IndexNow, que leem este
 * sitemap. Fonte única da decisão: nenhuma vaga noindex (concursos, talent pools, estágios,
 * "Outros" sem pista de saúde, >90 dias…) nem com prazo nas próximas 72 h (lib/indexable.ts).
 */
export async function listSitemapJobs(now: number = Date.now()): Promise<Job[]> {
  return (await dedupeShownBySlug(await getJobs())).filter((job) => !isConcursoJob(job) && isSitemapJob(job, now));
}

/**
 * Um URL por slug (A3). A página mostra getJobCard(slug) (primeira publicada do ficheiro, não a ordem da
 * lista), por isso nos slugs repetidos fica a vaga com a mesma fonte+sourceId desse cartão (senão a primeira).
 */
async function dedupeShownBySlug(jobs: Job[]): Promise<Job[]> {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const group = groups.get(job.slug);
    if (group) group.push(job);
    else groups.set(job.slug, [job]);
  }
  const out: Job[] = [];
  for (const [slug, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const shown = (await getJobCard(slug))?.job;
    out.push(
      (shown && group.find((job) => job.source === shown.source && job.sourceId === shown.sourceId)) || group[0],
    );
  }
  return out;
}

/** lastmod de uma vaga: a publicação; sem data válida a 1.ª vez vista; nunca "agora" (mudaria todos os dias). */
export function jobLastmod(job: Job, now: number = Date.now()): Date | null {
  return pickLastmod([job.publishedAt, job.firstSeenAt], now);
}

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Metadados para a fila da Indexing API/IndexNow (tools/indexing_notify.py): só dados que já são
 * públicos na página da vaga. siblings = nº de vagas do sitemap com a mesma empresa+título
 * (1 = única); sourceCount = vagas do sitemap da mesma fonte (pequeno = fonte rara).
 */
export function buildJobsMeta(jobs: Job[], siteUrl: string, now: number = Date.now()) {
  const siblings = new Map<string, number>();
  const sources = new Map<string, number>();
  for (const job of jobs) {
    const key = `${normalizeKey(job.company)}|${normalizeKey(job.title)}`;
    siblings.set(key, (siblings.get(key) ?? 0) + 1);
    const source = job.source ?? "";
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }
  return jobs.map((job) => ({
    url: `${siteUrl}/vagas/${job.slug}`,
    lastmod: (jobLastmod(job, now) ?? new Date(now)).toISOString(),
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt ?? null,
    expiresAt: job.expiresAt ?? null,
    source: job.source ?? "",
    profession: job.profession,
    clinical: isClinicalJob(job),
    siblings: siblings.get(`${normalizeKey(job.company)}|${normalizeKey(job.title)}`) ?? 1,
    sourceCount: sources.get(job.source ?? "") ?? 1,
  }));
}
