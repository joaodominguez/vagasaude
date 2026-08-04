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
  job: { title: string; company: string; profession: string },
  query: string,
) {
  const q = query.trim().toLocaleLowerCase("pt");
  if (!q) return 0;
  const title = job.title.toLocaleLowerCase("pt");
  const company = job.company.toLocaleLowerCase("pt");
  const profession = job.profession.toLocaleLowerCase("pt");
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (profession.includes(q)) return 40;
  if (company.includes(q)) return 25;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => title.includes(w))) return 50;
  return 0;
}
