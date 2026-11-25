import { foldText, parseQuery, stemmedHasAll, stemmedText } from "@/lib/search-text";
/** Normaliza tipos de contrato para filtros estáveis. */
export const CONTRACT_FILTERS = [
  "Tempo inteiro",
  "Tempo parcial",
  "Turnos",
  "Prestação de serviços",
  "Contrato",
] as const;

export type ContractFilter = (typeof CONTRACT_FILTERS)[number];

export function contractBucket(contract: string | null | undefined): string {
  const raw = (contract || "").trim();
  if (!raw || raw === "A definir") return "A definir";
  const t = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt");

  if (
    t.includes("parcial") ||
    t.includes("part_time") ||
    t.includes("part-time") ||
    t.includes("part time")
  ) {
    return "Tempo parcial";
  }
  if (t.includes("turno")) return "Turnos";
  if (
    t.includes("prestacao") ||
    t.includes("recibo") ||
    t.includes("avença") ||
    t.includes("avenca")
  ) {
    return "Prestação de serviços";
  }
  if (
    t.includes("inteiro") ||
    t.includes("full") ||
    t.includes("indeterminado") ||
    t.includes("sem termo") ||
    t.includes("completo")
  ) {
    return "Tempo inteiro";
  }
  if (t.includes("contrato") || t.includes("termo") || t.includes("ctfp")) {
    return "Contrato";
  }
  return "Contrato";
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
  const q = parseQuery(query, "pt");
  if (!q.folded) return 0;
  const title = foldText(job.title, "pt");
  const company = foldText(job.company, "pt");
  const profession = foldText(job.profession, "pt");
  if (title === q.folded) return 100;
  if (title.startsWith(q.folded)) return 80;
  if (title.includes(q.folded)) return 60;
  if (profession.includes(q.folded)) return 40;
  if (company.includes(q.folded)) return 25;
  const multi = q.stems.length > 1;
  if (multi && stemmedHasAll(stemmedText(job.title, "pt"), q)) return 50;
  if (stemmedHasAll(stemmedText(job.title, "pt"), q)) return 45;
  if (job.description) {
    if (foldText(job.description, "pt").includes(q.folded)) return 15;
    if (multi && stemmedHasAll(stemmedText(job.description, "pt"), q)) return 10;
  }
  return 0;
}
