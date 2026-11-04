export type JobSourceMeta = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  sector: "Público" | "Privado" | "Concertado";
  /** Sem logótipo, o cartão de parceiros mostra o nome. */
  logo?: string;
};

export const JOB_SOURCES: JobSourceMeta[] = [
  {
    id: "boe",
    name: "BOE — Oposiciones y concursos sanitarios",
    shortName: "BOE",
    url: "https://www.boe.es/diario_boe/",
    sector: "Público",
  },
  {
    id: "osakidetza",
    name: "Osakidetza — Listas de contratación temporal",
    shortName: "Osakidetza",
    url: "https://www.osakidetza.euskadi.eus/contratacion-temporal/webosk00-procon/es/",
    sector: "Público",
  },
  {
    id: "amavir",
    name: "Amavir — Empleo",
    shortName: "Amavir",
    url: "https://empleo.amavir.es/jobs",
    sector: "Privado",
  },
  {
    id: "sanitas",
    name: "Sanitas — Empleo",
    shortName: "Sanitas",
    url: "https://empleo.sanitas.es/jobs",
    sector: "Privado",
  },
  {
    id: "hospiten",
    name: "Hospiten — Empleo",
    shortName: "Hospiten",
    url: "https://jobs.hospiten.com/",
    sector: "Privado",
  },
];

export const SOURCE_META = Object.fromEntries(
  JOB_SOURCES.map((source) => [
    source.id,
    { name: source.name, url: source.url, sector: source.sector },
  ]),
) as Record<string, { name: string; url: string; sector: string }>;
