/**
 * Dados das secções da homepage do VagaSaúde: entrada por área profissional
 * («Que área procuras?») e «dois caminhos» SNS / privado. Tudo calculado a partir das
 * vagas ativas (só as etiquetas são fixas).
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { listEmployers, type Employer } from "@/lib/employers";
import { isPublicJob } from "@/lib/job-type";

export type HomeArea = {
  key: string;
  label: string;
  description: string;
  /** Profissão cujo ícone se usa (e cuja landing é o destino). */
  iconProfession: string;
  professions: string[];
  count: number;
  href: string;
};

const AREAS: Array<Omit<HomeArea, "count" | "href">> = [
  {
    key: "enfermagem",
    label: "Enfermagem",
    description: "Hospitais, centros de saúde, lares e cuidados ao domicílio.",
    iconProfession: "Enfermagem",
    professions: ["Enfermagem"],
  },
  {
    key: "medicina",
    label: "Medicina e medicina dentária",
    description: "Médicos de família, especialistas e médicos dentistas.",
    iconProfession: "Medicina",
    professions: ["Medicina"],
  },
  {
    key: "tecnicos",
    label: "Técnicos de saúde",
    description: "Diagnóstico, terapia da fala e ocupacional, análises clínicas.",
    iconProfession: "Técnico de Saúde",
    professions: ["Técnico de Saúde"],
  },
  {
    key: "fisioterapia",
    label: "Fisioterapia",
    description: "Clínicas, hospitais, desporto e domicílio.",
    iconProfession: "Fisioterapia",
    professions: ["Fisioterapia"],
  },
  {
    key: "farmacia",
    label: "Farmácia",
    description: "Farmacêuticos e técnicos de farmácia.",
    iconProfession: "Farmácia",
    professions: ["Farmácia"],
  },
  {
    key: "auxiliares",
    label: "Auxiliares e cuidadores",
    description: "Técnicos auxiliares de saúde, ação médica e geriatria.",
    iconProfession: "Auxiliares",
    professions: ["Auxiliares"],
  },
];

export function listHomeAreas(jobs: Job[]): HomeArea[] {
  const byProfession = new Map<string, number>();
  for (const job of jobs) byProfession.set(job.profession, (byProfession.get(job.profession) ?? 0) + 1);
  return AREAS.map((area) => {
    const ranked = area.professions
      .map((profession) => ({ profession, count: byProfession.get(profession) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    const top = ranked[0].profession;
    const count = ranked.reduce((sum, item) => sum + item.count, 0);
    const href = isCategoryEligible(jobs, top, null)
      ? categoryPath(top, null)
      : `/vagas?profissao=${encodeURIComponent(top)}`;
    return { ...area, count, href };
  }).filter((area) => area.count > 0);
}

export type HomePath = { count: number; employers: Employer[] };

/** «Dois caminhos»: vagas públicas (SNS) e privadas/sociais, com as primeiras entidades de cada uma. */
export function homePaths(jobs: Job[]): { publicPath: HomePath; privatePath: HomePath } {
  const employers = listEmployers(jobs);
  const isPublicEmployer = (employer: Employer) => employer.jobs.some((job) => isPublicJob(job));
  const publicCount = jobs.filter((job) => isPublicJob(job)).length;
  return {
    publicPath: { count: publicCount, employers: employers.filter(isPublicEmployer).slice(0, 3) },
    privatePath: {
      count: jobs.length - publicCount,
      employers: employers.filter((employer) => !isPublicEmployer(employer)).slice(0, 3),
    },
  };
}

/** «Atualizado há 2 h», com o último `lastSeenAt` registado pelos scrapers. */
export function freshnessLabel(jobs: Job[], now = Date.now()): string | null {
  let latest = 0;
  for (const job of jobs) {
    const t = Date.parse(job.lastSeenAt || job.publishedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return null;
  const minutes = Math.max(0, Math.round((now - latest) / 60_000));
  if (minutes < 60) return "Atualizado há instantes";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours} h`;
  const days = Math.round(hours / 24);
  return `Atualizado há ${days} ${days === 1 ? "dia" : "dias"}`;
}
