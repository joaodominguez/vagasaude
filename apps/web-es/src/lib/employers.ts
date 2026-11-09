/**
 * Páginas de empregador (/empresas/[slug]) — para profissionais de saúde.
 *
 * Agrupa as vagas ativas por empresa (nome já normalizado nos cards). Só gera página
 * para empregadores com EMPLOYER_MIN_JOBS vagas ou mais; anunciantes anónimos
 * ("confidencial", "via SINE"...) ficam de fora. Tudo é calculado a partir das vagas —
 * nada de avaliações, seguros ou dados de doentes.
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible, toCategorySlug } from "@/lib/categories";
import { parseAnnouncedSalary } from "@/lib/seo";

export const EMPLOYER_MIN_JOBS = 5;
export const EMPLOYER_JOBS_SHOWN = 30;

const ANONYMOUS_RE = /anunciante|confidencial|sigilos|n[aã]o divulgad|n[aã]o informad|via (sine|iefp|sne)|empresa parceira/i;

export type Employer = {
  slug: string;
  name: string;
  path: string;
  jobs: Job[];
};

export function employerPath(slug: string) {
  return `/empresas/${slug}`;
}

const cache = new WeakMap<Job[], Employer[]>();

/** Empregadores elegíveis, por nº de vagas (desc). */
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
  list.sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name, "es"));
  cache.set(jobs, list);
  return list;
}

export function findEmployer(jobs: Job[], slug: string) {
  return listEmployers(jobs).find((employer) => employer.slug === slug) ?? null;
}

/** Empresa com vagas, mas abaixo do mínimo (redirecionar para o índice, não 404). */
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
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
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

/** Salários mensais anunciados nas vagas (valor médio de cada faixa). Só profissões com ≥ 3 amostras. */
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
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function listLabels(items: { label: string }[], max = 3) {
  const labels = items.slice(0, max).map((item) => item.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

export function employerIntro(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const plural = stats.count === 1 ? "oferta activa" : "ofertas activas";
  return (
    `${employer.name} tiene ${stats.count} ${plural} en VacantesSalud, sobre todo en ` +
    `${listLabels(stats.professions)}` +
    (stats.districts.length ? `, sobre todo en ${listLabels(stats.districts)}` : "") +
    ". Las ofertas se actualizan cada día a partir de fuentes oficiales y de las webs de empleo " +
    "de los empleadores; la inscripción se hace siempre en el canal oficial indicado en cada oferta."
  );
}

export function employerFaq(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `¿Cuántas ofertas de empleo tiene ${employer.name}?`,
      a: `Ahora mismo hay ${stats.count} ${stats.count === 1 ? "oferta activa" : "ofertas activas"} de ${employer.name} en VacantesSalud. La cifra cambia cada día, a medida que se publican nuevas ofertas y otras se cierran.`,
    },
    {
      q: `¿Qué profesionales busca ${employer.name}?`,
      a: `Las áreas con más ofertas son ${stats.professions.map((p) => `${p.label} (${p.count})`).slice(0, 5).join(", ")}.`,
    },
  ];
  if (stats.districts.length) {
    faq.push({
      q: `¿En qué comunidades tiene ofertas ${employer.name}?`,
      a: `Hay ofertas sobre todo en ${stats.districts.map((d) => `${d.label} (${d.count})`).slice(0, 6).join(", ")}${
        stats.cities.length ? `; las localidades con más ofertas son ${listLabels(stats.cities, 4)}` : ""
      }.`,
    });
  }
  if (stats.salaries.length) {
    const top = stats.salaries[0];
    faq.push({
      q: `¿Cuánto paga ${employer.name}?`,
      a: `Entre las ofertas que publican salario, la retribución mensual mediana en ${top.profession} es de ${formatMoney(top.median)} (de ${formatMoney(top.min)} a ${formatMoney(top.max)}, en ${top.samples} ofertas). Muchas ofertas no publican el salario; compruébalo siempre en el anuncio.`,
    });
  }
  faq.push({
    q: `¿Cómo me inscribo en una oferta de ${employer.name}?`,
    a: `Abre la oferta que te interese y usa el botón de inscripción: te lleva al canal oficial (web de empleo de la empresa o plataforma de selección). VacantesSalud no cobra nada ni intermedia en las candidaturas.`,
  });
  return faq;
}

/** lastmod real: vaga mais recente da empresa. */
export function employerLastmod(employer: Employer, fallback: Date) {
  const now = Date.now();
  let newest = 0;
  for (const job of employer.jobs) {
    const t = Date.parse(job.publishedAt);
    if (!Number.isNaN(t) && t <= now && t > newest) newest = t;
  }
  return newest ? new Date(newest) : fallback;
}
