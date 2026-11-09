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
  list.sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name, "pt"));
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
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
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
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function listLabels(items: { label: string }[], max = 3) {
  const labels = items.slice(0, max).map((item) => item.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export function employerIntro(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const plural = stats.count === 1 ? "vaga aberta" : "vagas abertas";
  return (
    `${employer.name} tem ${stats.count} ${plural} no VagaSaúde, sobretudo em ` +
    `${listLabels(stats.professions)}` +
    (stats.districts.length ? `, com destaque para ${listLabels(stats.districts)}` : "") +
    ". As vagas são atualizadas todos os dias a partir de fontes oficiais e dos sites de " +
    "recrutamento dos empregadores; a candidatura é sempre feita no canal oficial indicado em cada vaga."
  );
}

export function employerFaq(employer: Employer, stats: ReturnType<typeof employerStats>) {
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `Quantas vagas abertas existem em ${employer.name}?`,
      a: `Neste momento há ${stats.count} ${stats.count === 1 ? "vaga ativa" : "vagas ativas"} de ${employer.name} no VagaSaúde. O número muda todos os dias, à medida que novas vagas são publicadas e outras encerram.`,
    },
    {
      q: `Que profissionais ${employer.name} está contratando?`,
      a: `As áreas com mais vagas são ${stats.professions.map((p) => `${p.label} (${p.count})`).slice(0, 5).join(", ")}.`,
    },
  ];
  if (stats.districts.length) {
    faq.push({
      q: `Em que estados ${employer.name} tem vagas?`,
      a: `Há vagas sobretudo em ${stats.districts.map((d) => `${d.label} (${d.count})`).slice(0, 6).join(", ")}${
        stats.cities.length ? `; as cidades com mais vagas são ${listLabels(stats.cities, 4)}` : ""
      }.`,
    });
  }
  if (stats.salaries.length) {
    const top = stats.salaries[0];
    faq.push({
      q: `Quanto paga ${employer.name}?`,
      a: `Entre as vagas que publicam salário, a remuneração mensal mediana em ${top.profession} é de ${formatMoney(top.median)} (de ${formatMoney(top.min)} a ${formatMoney(top.max)}, em ${top.samples} vagas). Muitas vagas não divulgam o salário; confirme sempre no anúncio.`,
    });
  }
  faq.push({
    q: `Como me candidato a uma vaga em ${employer.name}?`,
    a: `Abra a vaga que lhe interessa e use o botão de candidatura: ele leva ao canal oficial (site de carreiras da empresa ou plataforma de recrutamento). O VagaSaúde não cobra nada nem intermedia candidaturas.`,
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
