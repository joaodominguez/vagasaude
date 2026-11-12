/**
 * Pagine azienda (/aziende/[slug]) per i professionisti della sanità.
 *
 * Raggruppa le offerte attive per azienda (nome già normalizzato nelle card). Genera una pagina
 * solo per i datori di lavoro con almeno EMPLOYER_MIN_JOBS offerte; gli annunci anonimi
 * ("riservato", "azienda confidenziale"...) restano esclusi. Tutto è calcolato dalle offerte:
 * niente recensioni, assicurazioni o dati dei pazienti.
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible, toCategorySlug } from "@/lib/categories";
import { parseAnnouncedSalary } from "@/lib/seo";

export const EMPLOYER_MIN_JOBS = 5;
export const EMPLOYER_JOBS_SHOWN = 30;

const ANONYMOUS_RE = /azienda (riservata|confidenziale|non indicata|non specificata)|ente riservato|societ[aà] riservata|annunciante|riservato|confidenziale|n\.?d\.?$/i;

export type Employer = {
  slug: string;
  name: string;
  path: string;
  jobs: Job[];
};

export function employerPath(slug: string) {
  return `/aziende/${slug}`;
}

const cache = new WeakMap<Job[], Employer[]>();

/** Datori di lavoro idonei, per numero di offerte (decrescente). */
export function listEmployers(jobs: Job[]): Employer[] {
  const cached = cache.get(jobs);
  if (cached) return cached;
  const groups = new Map<string, { names: Map<string, number>; jobs: Job[] }>();
  for (const job of jobs) {
    const name = (job.company || "").trim();
    if (!name || ANONYMOUS_RE.test(name)) continue;
    const slug = toCategorySlug(name);
    if (!slug) continue;
    const group: { names: Map<string, number>; jobs: Job[] } = groups.get(slug) ?? { names: new Map(), jobs: [] };
    group.names.set(name, (group.names.get(name) ?? 0) + 1);
    group.jobs.push(job);
    groups.set(slug, group);
  }
  const list: Employer[] = [];
  for (const [slug, group] of groups) {
    if (group.jobs.length < EMPLOYER_MIN_JOBS) continue;
    const name = [...group.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    list.push({ slug, name, path: employerPath(slug), jobs: group.jobs });
  }
  list.sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name, "it"));
  cache.set(jobs, list);
  return list;
}

export function findEmployer(jobs: Job[], slug: string) {
  return listEmployers(jobs).find((employer) => employer.slug === slug) ?? null;
}

/** Azienda con offerte ma sotto il minimo (reindirizzare all'indice, non 404). */
export function hasAnyJobs(jobs: Job[], slug: string) {
  return jobs.some((job) => job.company && toCategorySlug(job.company) === slug);
}

function topCounts(values: string[], limit: number) {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export type EmployerLink = { label: string; count: number; href: string | null };

export function employerStats(employer: Employer, allJobs: Job[]) {
  const professions: EmployerLink[] = topCounts(employer.jobs.map((j) => j.profession), 8).map(
    (item) => ({
      ...item,
      href: isCategoryEligible(allJobs, item.label, null) ? categoryPath(item.label, null) : null,
    }),
  );
  const districts: EmployerLink[] = topCounts(employer.jobs.map((j) => j.district), 8).map(
    (item) => ({
      ...item,
      href: isCategoryEligible(allJobs, null, item.label) ? categoryPath(null, item.label) : null,
    }),
  );
  const cities = topCounts(employer.jobs.map((j) => j.city).filter(Boolean), 10);
  return { count: employer.jobs.length, professions, districts, cities, salaries: salaryStats(employer.jobs) };
}

export type SalaryRow = { profession: string; samples: number; min: number; max: number; median: number };

/** Retribuzioni mensili indicate nelle offerte (valore medio di ciascuna fascia). Solo professioni con almeno 3 campioni. */
function salaryStats(jobs: Job[]): SalaryRow[] {
  const byProfession = new Map<string, number[]>();
  for (const job of jobs) {
    const parsed = parseAnnouncedSalary(job.salary);
    if (!parsed || parsed.unitText !== "MONTH") continue;
    const value =
      parsed.value ??
      (parsed.minValue != null && parsed.maxValue != null
        ? (parsed.minValue + parsed.maxValue) / 2
        : undefined);
    if (!value || value < 500 || value > 100000) continue;
    const list = byProfession.get(job.profession) ?? [];
    list.push(value);
    byProfession.set(job.profession, list);
  }
  const rows: SalaryRow[] = [];
  for (const [profession, values] of byProfession) {
    if (values.length < 3) continue;
    values.sort((a, b) => a - b);
    rows.push({
      profession,
      samples: values.length,
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)],
    });
  }
  return rows.sort((a, b) => b.samples - a.samples).slice(0, 6);
}

export function formatMoney(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function listLabels(items: { label: string }[], max = 3) {
  const labels = items.slice(0, max).map((item) => item.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export function employerIntro(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const plural = stats.count === 1 ? "offerta attiva" : "offerte attive";
  return (
    `${employer.name} ha ${stats.count} ${plural} su Offerte Sanità, soprattutto in ` +
    `${listLabels(stats.professions)}` +
    (stats.districts.length ? `, in prevalenza in ${listLabels(stats.districts)}` : "") +
    ". Le offerte vengono aggiornate ogni giorno a partire dalle fonti ufficiali e dai siti di " +
    "recruiting dei datori di lavoro; la candidatura si invia sempre sul canale ufficiale indicato in ogni offerta."
  );
}

export function employerFaq(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `Quante offerte di lavoro ha ${employer.name}?`,
      a: `In questo momento ci sono ${stats.count} ${stats.count === 1 ? "offerta attiva" : "offerte attive"} di ${employer.name} su Offerte Sanità. Il numero cambia ogni giorno, man mano che vengono pubblicate nuove offerte e altre si chiudono.`,
    },
    {
      q: `Quali professionisti cerca ${employer.name}?`,
      a: `Le aree con più offerte sono ${stats.professions.map((p) => `${p.label} (${p.count})`).slice(0, 5).join(", ")}.`,
    },
  ];
  if (stats.districts.length) {
    faq.push({
      q: `In quali regioni ha offerte ${employer.name}?`,
      a: `Ci sono offerte soprattutto in ${stats.districts.map((d) => `${d.label} (${d.count})`).slice(0, 6).join(", ")}${
        stats.cities.length ? `; le località con più offerte sono ${listLabels(stats.cities, 4)}` : ""
      }.`,
    });
  }
  if (stats.salaries.length) {
    const top = stats.salaries[0];
    faq.push({
      q: `Quanto paga ${employer.name}?`,
      a: `Tra le offerte che indicano la retribuzione, la mediana mensile per ${top.profession} è di ${formatMoney(top.median)} (da ${formatMoney(top.min)} a ${formatMoney(top.max)}, su ${top.samples} offerte). Molte offerte non indicano la retribuzione: verificala sempre nell'annuncio.`,
    });
  }
  faq.push({
    q: `Come mi candido a un'offerta di ${employer.name}?`,
    a: `Apri l'offerta che ti interessa e usa il pulsante di candidatura: ti porta al canale ufficiale (sito di lavoro dell'azienda o piattaforma di selezione). Offerte Sanità non richiede alcun pagamento e non fa da intermediario nelle candidature.`,
  });
  return faq;
}

/** lastmod reale: offerta più recente dell'azienda. */
export function employerLastmod(employer: Employer, fallback: Date) {
  const now = Date.now();
  let newest = 0;
  for (const job of employer.jobs) {
    const t = Date.parse(job.publishedAt);
    if (!Number.isNaN(t) && t <= now && t > newest) newest = t;
  }
  return newest ? new Date(newest) : fallback;
}
