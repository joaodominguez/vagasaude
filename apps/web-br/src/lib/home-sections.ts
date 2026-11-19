/**
 * Dados das seções da home do VagaSaúde Brasil: entrada por área profissional
 * («Que área você procura?») e «dois caminhos» setor público / privado. Tudo calculado
 * a partir das vagas ativas (só os rótulos são fixos).
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { listEmployers, type Employer } from "@/lib/employers";
import { isPublicJob } from "@/lib/job-type";

export type HomeArea = {
  key: string;
  label: string;
  description: string;
  /** Profissão cujo ícone se usa (ver profession-icon). */
  iconProfession: string;
  professions: string[];
  count: number;
  href: string;
};

const AREAS: Array<Omit<HomeArea, "count" | "href">> = [
  {
    key: "enfermagem",
    label: "Enfermagem",
    description: "Enfermeiros, técnicos e auxiliares em hospitais, UPAs, clínicas e home care.",
    iconProfession: "Enfermagem",
    professions: ["Enfermagem"],
  },
  {
    key: "medicina",
    label: "Medicina",
    description: "Médicos plantonistas, clínicos e especialistas na rede pública e privada.",
    iconProfession: "Medicina",
    professions: ["Medicina"],
  },
  {
    key: "tecnicos",
    label: "Técnicos de saúde",
    description: "Laboratório, radiologia, saúde bucal e outras profissões técnicas.",
    iconProfession: "Técnico de Saúde",
    professions: ["Técnico de Saúde"],
  },
  {
    key: "fisioterapia",
    label: "Fisioterapia",
    description: "Clínicas, hospitais, reabilitação e atendimento domiciliar.",
    iconProfession: "Fisioterapia",
    professions: ["Fisioterapia"],
  },
  {
    key: "farmacia",
    label: "Farmácia",
    description: "Farmacêuticos e auxiliares em drogarias, hospitais e indústria.",
    iconProfession: "Farmácia",
    professions: ["Farmácia"],
  },
  {
    key: "auxiliares",
    label: "Auxiliares e apoio",
    description: "Auxiliares de saúde, cuidadores, recepção hospitalar e apoio assistencial.",
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

/** «Dois caminhos»: vagas do setor público (SUS) e privadas/filantrópicas, com as primeiras entidades. */
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

/** «Atualizado há 2 h», a partir do dado mais recente visto pelos scrapers (lastSeenAt). */
export function freshnessLabel(jobs: Job[], now = Date.now()): string | null {
  let latest = 0;
  for (const job of jobs) {
    const t = Date.parse(job.lastSeenAt || job.publishedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return null;
  const minutes = Math.max(0, Math.round((now - latest) / 60_000));
  if (minutes < 60) return "Atualizado há poucos minutos";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours} h`;
  const days = Math.round(hours / 24);
  return `Atualizado há ${days} ${days === 1 ? "dia" : "dias"}`;
}
