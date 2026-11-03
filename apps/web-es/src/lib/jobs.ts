export type Job = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Público" | "Privado" | "Concertado";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
  /** Última vez que el scraper devolvió la oferta (base del validThrough). */
  lastSeenAt?: string | null;
  /** Fuente de origen. */
  source?: string;
  /** ID de la oferta en la fuente (identifier del JobPosting). */
  sourceId?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationUrl: string;
  /** Retribución anunciada en la fuente (si existe). */
  salary?: string | null;
  featured?: boolean;
};

/** Ofertas de demostración (solo desarrollo; en producción nunca se muestran). */
export const jobs: Job[] = [
  {
    slug: "enfermero-urgencias-hospital-ejemplo-madrid",
    title: "Enfermero/a — Servicio de Urgencias",
    company: "Hospital de Ejemplo Madrid",
    district: "Madrid",
    city: "Madrid",
    sector: "Privado",
    contract: "Jornada completa",
    profession: "Enfermería",
    publishedLabel: "Hoy",
    publishedAt: "2026-08-02",
    description:
      "Buscamos un/a enfermero/a para integrarse en el equipo del Servicio de Urgencias, garantizando una atención de calidad y la seguridad de los pacientes.",
    requirements: [
      "Grado en Enfermería y colegiación vigente.",
      "Experiencia en urgencias (valorable).",
      "Capacidad de trabajo en equipo y buena gestión del estrés.",
      "Disponibilidad para turnos rotatorios.",
    ],
    responsibilities: [
      "Prestar cuidados de enfermería de calidad.",
      "Valorar y monitorizar el estado clínico de los pacientes.",
      "Administrar tratamientos y realizar técnicas de enfermería.",
      "Registrar las intervenciones en la historia clínica.",
    ],
    applicationUrl: "https://example.com/",
    featured: true,
  },
  {
    slug: "medico-familia-servicio-salud-sevilla",
    title: "Médico/a de Familia",
    company: "Servicio de Salud (ejemplo)",
    district: "Andalucía",
    city: "Sevilla",
    sector: "Público",
    contract: "Temporal",
    profession: "Medicina",
    publishedLabel: "Hoy",
    publishedAt: "2026-08-02",
    description:
      "Contratación temporal de médico/a de familia para un centro de salud de Atención Primaria, con foco en prevención y seguimiento continuado.",
    requirements: [
      "Licenciatura/Grado en Medicina y especialidad en Medicina Familiar y Comunitaria.",
      "Colegiación vigente.",
    ],
    responsibilities: [
      "Atender consultas programadas y urgentes.",
      "Coordinarse con enfermería y trabajo social.",
    ],
    applicationUrl: "https://example.com/",
  },
  {
    slug: "fisioterapeuta-clinica-rehabilitacion-valencia",
    title: "Fisioterapeuta",
    company: "Clínica de Rehabilitación (ejemplo)",
    district: "Comunidad Valenciana",
    city: "Valencia",
    sector: "Privado",
    contract: "Jornada completa",
    profession: "Fisioterapia",
    publishedLabel: "Ayer",
    publishedAt: "2026-08-01",
    description:
      "Clínica de rehabilitación busca fisioterapeuta para valoración y tratamiento de pacientes con patología musculoesquelética y neurológica.",
    requirements: ["Grado en Fisioterapia.", "Colegiación vigente."],
    responsibilities: ["Valorar y tratar a los pacientes.", "Elaborar planes de rehabilitación."],
    applicationUrl: "https://example.com/",
  },
  {
    slug: "tcae-residencia-mayores-barcelona",
    title: "TCAE — Residencia de mayores",
    company: "Residencia (ejemplo)",
    district: "Cataluña",
    city: "Barcelona",
    sector: "Concertado",
    contract: "Turnos",
    profession: "TCAE",
    publishedLabel: "Ayer",
    publishedAt: "2026-08-01",
    description:
      "Residencia de mayores busca TCAE (Técnico en Cuidados Auxiliares de Enfermería) para turnos rotativos, incluidos fines de semana.",
    requirements: ["Título de Técnico en Cuidados Auxiliares de Enfermería.", "Disponibilidad de turnos."],
    responsibilities: ["Apoyar en el aseo, movilización y alimentación de residentes.", "Colaborar con enfermería."],
    applicationUrl: "https://example.com/",
  },
];

export { districts, professions } from "@/lib/taxonomies";

export function getJob(slug: string) {
  return jobs.find((job) => job.slug === slug);
}
