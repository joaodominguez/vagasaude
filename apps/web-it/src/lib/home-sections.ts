/**
 * Dati delle sezioni della home di OfferteSanità: ingresso per area professionale
 * («Che area cerchi?») e «due strade» pubblico / privato. Tutto calcolato dalle offerte
 * attive (solo le etichette sono fisse).
 */
import type { Job } from "@/lib/jobs";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import { listEmployers, type Employer } from "@/lib/employers";
import { isPublicJob } from "@/lib/job-type";

export type HomeArea = {
  key: string;
  label: string;
  description: string;
  /** Icona (nome in profession-icon: si usa la professione principale). */
  iconProfession: string;
  professions: string[];
  count: number;
  href: string;
};

const AREAS: Array<Omit<HomeArea, "count" | "href">> = [
  {
    key: "medicina",
    label: "Medicina e odontoiatria",
    description: "Dirigenti medici, specialisti e odontoiatri: da concorsi pubblici e strutture private.",
    iconProfession: "Medicina",
    professions: ["Medicina", "Odontoiatria"],
  },
  {
    key: "infermieristica",
    label: "Infermieristica e ostetricia",
    description: "Infermieri e ostetriche in ospedali, RSA, ambulatori e assistenza domiciliare.",
    iconProfession: "Infermieristica",
    professions: ["Infermieristica", "Ostetricia"],
  },
  {
    key: "oss",
    label: "OSS e assistenza",
    description: "Operatori socio-sanitari e assistenza alla persona in struttura e a domicilio.",
    iconProfession: "OSS",
    professions: ["OSS", "Servizio sociale"],
  },
  {
    key: "tecnici",
    label: "Tecnici sanitari",
    description: "Laboratorio, radiologia, neurofisiopatologia e altre professioni tecniche.",
    iconProfession: "Tecnici sanitari",
    professions: ["Tecnici sanitari", "Ottica e audiometria"],
  },
  {
    key: "riabilitazione",
    label: "Fisioterapia e riabilitazione",
    description: "Fisioterapisti, logopedisti, terapisti occupazionali ed educatori professionali.",
    iconProfession: "Fisioterapia",
    professions: ["Fisioterapia", "Logopedia e riabilitazione"],
  },
  {
    key: "veterinaria",
    label: "Veterinaria",
    description: "Medici veterinari e tecnici in cliniche e ospedali veterinari.",
    iconProfession: "Veterinaria",
    professions: ["Veterinaria"],
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
      : `/offerte?professione=${encodeURIComponent(top)}`;
    return { ...area, count, href };
  }).filter((area) => area.count > 0);
}

export type HomePath = { count: number; employers: Employer[] };

/** «Due strade»: offerte pubbliche (SSN) e private/accreditate, con i primi enti di ciascuna. */
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

/** «Aggiornato 2 h fa», dal dato più recente visto dagli scraper. */
export function freshnessLabel(jobs: Job[], now = Date.now()): string | null {
  let latest = 0;
  for (const job of jobs) {
    const t = Date.parse(job.lastSeenAt || job.publishedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return null;
  const minutes = Math.max(0, Math.round((now - latest) / 60_000));
  if (minutes < 60) return "Aggiornato poco fa";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Aggiornato ${hours} h fa`;
  const days = Math.round(hours / 24);
  return `Aggiornato ${days} ${days === 1 ? "giorno" : "giorni"} fa`;
}
