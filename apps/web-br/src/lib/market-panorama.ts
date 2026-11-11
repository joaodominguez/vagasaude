import { cache } from "react";
import type { Job } from "@/lib/jobs";
import { getListingJobs } from "@/lib/jobs-data";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { contractBucket } from "@/lib/contracts";
import { listEmployers } from "@/lib/employers";
import { parseMonthlySalary } from "@/lib/salary-observatory";

/**
 * Panorama do mercado de trabalho na saúde (página /dados): números agregados das vagas
 * ativas do site, para jornalistas, blogs e profissionais citarem. Usa a mesma lista das
 * listagens (sem concursos) e as mesmas regras das páginas de categoria, empresas e salários,
 * para os números baterem certo em todo o site.
 */
export type PanoramaRow = {
  label: string;
  count: number;
  /** Fração do total (0–1). */
  share: number;
  /** Página do site com essas vagas (só se existir e for elegível). */
  href: string | null;
};

const DAY_MS = 86_400_000;
/** Vagas sem estado próprio (nacionais / remotas) aparecem como "Brasil". */
const NATIONAL = "Brasil";

function tally(jobs: Job[], key: (job: Job) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = key(job)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
}

function toRows(
  entries: Array<[string, number]>,
  total: number,
  hrefFor: (label: string) => string | null = () => null,
): PanoramaRow[] {
  return entries.map(([label, count]) => ({
    label,
    count,
    share: total ? count / total : 0,
    href: hrefFor(label),
  }));
}

export const getMarketPanorama = cache(async () => {
  const jobs = await getListingJobs();
  const total = jobs.length;
  const now = Date.now();

  const byState = toRows(
    tally(jobs, (job) => job.district),
    total,
    (state) => (isCategoryEligible(jobs, null, state) ? categoryPath(null, state) : null),
  ).map((row) =>
    row.label === NATIONAL ? { ...row, label: "Brasil (nacional ou remota)" } : row,
  );
  const byProfession = toRows(
    tally(jobs, (job) => (job.profession === "Outros" ? "Outras áreas" : job.profession)),
    total,
    (profession) =>
      profession !== "Outras áreas" && isCategoryEligible(jobs, profession, null)
        ? categoryPath(profession, null)
        : null,
  );
  const employers = listEmployers(jobs);
  const topEmployers: PanoramaRow[] = employers.slice(0, 15).map((employer) => ({
    label: employer.name,
    count: employer.jobs.length,
    share: total ? employer.jobs.length / total : 0,
    href: employer.path,
  }));
  const bySector = toRows(tally(jobs, (job) => job.sector), total);
  const byContract = toRows(
    tally(jobs, (job) => {
      const bucket = contractBucket(job.contract);
      return bucket === "A definir" ? "Não informado" : bucket;
    }),
    total,
  );

  const withSalary = jobs.filter((job) => parseMonthlySalary(job.salary) != null).length;
  const lastWeek = jobs.filter((job) => {
    const published = Date.parse(job.publishedAt);
    return !Number.isNaN(published) && now - published <= 7 * DAY_MS && published <= now;
  }).length;
  const companies = new Set(
    jobs.map((job) => (job.company || "").trim().toLowerCase()).filter(Boolean),
  ).size;
  const sources = new Set(jobs.map((job) => job.source).filter(Boolean)).size;

  return {
    generatedAt: new Date(now),
    total,
    companies,
    employerPages: employers.length,
    states: byState.filter((row) => !row.label.startsWith(NATIONAL)).length,
    sources,
    lastWeek,
    withSalary,
    withSalaryShare: total ? withSalary / total : 0,
    byState,
    byProfession: byProfession.slice(0, 15),
    professions: byProfession.length,
    topEmployers,
    bySector,
    byContract,
  };
});
