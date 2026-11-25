import { foldText, lightText, parseQuery, stemmedHasAll, stemmedText } from "@/lib/search-text";
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
  const q = parseQuery(query, "es");
  if (!q.folded) return 0;
  const title = foldText(job.title, "es");
  const company = foldText(job.company, "es");
  const profession = foldText(job.profession, "es");
  if (title === q.folded) return 100;
  if (title.startsWith(q.folded)) return 80;
  if (title.includes(q.folded)) return 60;
  if (profession.includes(q.folded)) return 40;
  if (company.includes(q.folded)) return 25;
  const multi = q.stems.length > 1;
  if (multi && stemmedHasAll(stemmedText(job.title, "es"), q)) return 50;
  if (stemmedHasAll(stemmedText(job.title, "es"), q)) return 45;
  if (job.description) {
    if (foldText(job.description, "es").includes(q.folded)) return 15;
    if (multi && stemmedHasAll(lightText(job.description, "es"), q)) return 10;
  }
  return 0;
}
