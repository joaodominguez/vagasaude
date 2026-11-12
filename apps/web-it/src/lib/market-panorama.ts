import { cache } from "react";
import type { Job } from "@/lib/jobs";
import { getJobs } from "@/lib/jobs-data";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { CONTRACT_UNKNOWN, contractBucket } from "@/lib/contracts";
import { listEmployers } from "@/lib/employers";
import { parseMonthlySalaryEur } from "@/lib/salary-observatory";

/**
 * Panorama del mercato del lavoro sanitario (pagina /dati): numeri aggregati delle offerte
 * attive del sito, citabili da giornalisti, blog e professionisti. Usa lo stesso elenco delle
 * liste e le stesse regole delle pagine di categoria, aziende e stipendi, così i numeri
 * coincidono in tutto il sito. Funziona anche con zero offerte.
 */
export type PanoramaRow = {
  label: string;
  count: number;
  /** Quota sul totale (0–1). */
  share: number;
  /** Pagina del sito con queste offerte (solo se esiste ed è idonea). */
  href: string | null;
};

const DAY_MS = 86_400_000;
/** Offerte senza regione propria (nazionali / da remoto) compaiono come "Italia". */
const NATIONAL = "Italia";

function tally(jobs: Job[], key: (job: Job) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = key(job)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));
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
  const jobs = await getJobs();
  const total = jobs.length;
  const now = Date.now();

  const byState = toRows(
    tally(jobs, (job) => job.district),
    total,
    (state) => (isCategoryEligible(jobs, null, state) ? categoryPath(null, state) : null),
  ).map((row) =>
    row.label === NATIONAL ? { ...row, label: "Italia (nazionale o da remoto)" } : row,
  );
  const byProfession = toRows(
    tally(jobs, (job) => (job.profession === "Altro" ? "Altre aree" : job.profession)),
    total,
    (profession) =>
      profession !== "Altre aree" && isCategoryEligible(jobs, profession, null)
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
      return bucket === CONTRACT_UNKNOWN ? "Non indicato" : bucket;
    }),
    total,
  );

  const withSalary = jobs.filter((job) => parseMonthlySalaryEur(job.salary) != null).length;
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
