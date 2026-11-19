/**
 * Datos de las secciones de la home de VacantesSalud: entrada por área profesional
 * («¿Qué área buscas?») y «dos caminos» público / privado. Todo calculado a partir de las
 * ofertas activas (solo las etiquetas son fijas).
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { listEmployers, type Employer } from "@/lib/employers";
import { isPublicJob } from "@/lib/job-type";

export type HomeArea = {
  key: string;
  label: string;
  description: string;
  /** Icono (nombre en profession-icon: se usa la profesión principal). */
  iconProfession: string;
  professions: string[];
  count: number;
  href: string;
};

const AREAS: Array<Omit<HomeArea, "count" | "href">> = [
  {
    key: "medicina",
    label: "Medicina y odontología",
    description: "Médicos, especialistas y odontólogos: del SNS a la sanidad privada.",
    iconProfession: "Medicina",
    professions: ["Medicina", "Odontología"],
  },
  {
    key: "enfermeria",
    label: "Enfermería",
    description: "Enfermeros/as en hospitales, residencias, centros de salud y atención domiciliaria.",
    iconProfession: "Enfermería",
    professions: ["Enfermería"],
  },
  {
    key: "tcae",
    label: "TCAE y cuidados",
    description: "Técnicos en cuidados auxiliares de enfermería, celadores y apoyo asistencial.",
    iconProfession: "TCAE",
    professions: ["TCAE", "Celador", "Trabajo social"],
  },
  {
    key: "tecnicos",
    label: "Técnicos sanitarios",
    description: "Laboratorio, radiología, farmacia y otras profesiones técnicas.",
    iconProfession: "Técnico sanitario",
    professions: ["Técnico sanitario", "Técnico de farmacia", "Óptica y audiología"],
  },
  {
    key: "rehabilitacion",
    label: "Fisioterapia y rehabilitación",
    description: "Fisioterapeutas, logopedas y terapeutas ocupacionales.",
    iconProfession: "Fisioterapia",
    professions: ["Fisioterapia", "Psicología", "Nutrición"],
  },
  {
    key: "veterinaria",
    label: "Veterinaria y farmacia",
    description: "Veterinarios y farmacéuticos en clínicas, oficinas de farmacia y hospitales.",
    iconProfession: "Veterinaria",
    professions: ["Veterinaria", "Farmacia"],
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
      : `/empleo?profesion=${encodeURIComponent(top)}`;
    return { ...area, count, href };
  }).filter((area) => area.count > 0);
}

export type HomePath = { count: number; employers: Employer[] };

/** «Dos caminos»: ofertas públicas (SNS) y privadas/concertadas, con las primeras entidades de cada una. */
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

/** «Actualizado hace 2 h», con el último `lastSeenAt` registrado por los scrapers. */
export function freshnessLabel(jobs: Job[], now = Date.now()): string | null {
  let latest = 0;
  for (const job of jobs) {
    const t = Date.parse(job.lastSeenAt || job.publishedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return null;
  const minutes = Math.max(0, Math.round((now - latest) / 60_000));
  if (minutes < 60) return "Actualizado hace un momento";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Actualizado hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Actualizado hace ${days} ${days === 1 ? "día" : "días"}`;
}
