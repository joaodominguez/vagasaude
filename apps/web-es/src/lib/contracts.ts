/** Normaliza tipos de contrato para filtros estables. */
export const CONTRACT_FILTERS = [
  "Jornada completa",
  "Media jornada",
  "Turnos",
  "Autónomo",
  "Indefinido",
  "Temporal",
] as const;

export type ContractFilter = (typeof CONTRACT_FILTERS)[number];

/** Valor cuando la fuente no indica el tipo de contrato. */
export const CONTRACT_UNKNOWN = "Sin especificar";

export function contractBucket(contract: string | null | undefined): string {
  const raw = (contract || "").trim();
  if (!raw || raw === CONTRACT_UNKNOWN) return CONTRACT_UNKNOWN;
  const t = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es");

  if (
    t.includes("parcial") ||
    t.includes("media jornada") ||
    t.includes("part_time") ||
    t.includes("part-time") ||
    t.includes("part time")
  ) {
    return "Media jornada";
  }
  if (t.includes("turno") || t.includes("guardia")) return "Turnos";
  if (
    t.includes("autonomo") ||
    t.includes("prestacion de servicios") ||
    t.includes("freelance")
  ) {
    return "Autónomo";
  }
  if (
    t.includes("indefinid") ||
    t.includes("fijo") ||
    t.includes("plaza en propiedad")
  ) {
    return "Indefinido";
  }
  if (
    t.includes("temporal") ||
    t.includes("interin") ||
    t.includes("eventual") ||
    t.includes("sustitu") ||
    t.includes("obra y servicio") ||
    t.includes("duracion determinada")
  ) {
    return "Temporal";
  }
  if (t.includes("completa") || t.includes("full") || t.includes("completo")) {
    return "Jornada completa";
  }
  return CONTRACT_UNKNOWN;
}

export function scoreJobRelevance(
  job: {
    title: string;
    company: string;
    profession: string;
    description?: string;
  },
  query: string,
) {
  const q = query.trim().toLocaleLowerCase("es");
  if (!q) return 0;
  const title = job.title.toLocaleLowerCase("es");
  const company = job.company.toLocaleLowerCase("es");
  const profession = job.profession.toLocaleLowerCase("es");
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (profession.includes(q)) return 40;
  if (company.includes(q)) return 25;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => title.includes(w))) return 50;
  if (job.description) {
    const desc = job.description.toLocaleLowerCase("es");
    if (desc.includes(q)) return 15;
    if (words.length > 1 && words.every((w) => desc.includes(w))) return 10;
  }
  return 0;
}
