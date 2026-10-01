/** Normaliza tipos de contrato para filtros estáveis (mercado BR). */
export const CONTRACT_FILTERS = [
  "CLT",
  "PJ",
  "Estágio",
  "Temporário",
  "Plantão",
  "Meio período",
] as const;

export type ContractFilter = (typeof CONTRACT_FILTERS)[number];

export function contractBucket(contract: string | null | undefined): string {
  const raw = (contract || "").trim();
  if (!raw || raw === "A definir") return "A definir";
  const t = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  if (
    t.includes("parcial") ||
    t.includes("meio periodo") ||
    t.includes("part_time") ||
    t.includes("part-time") ||
    t.includes("part time")
  ) {
    return "Meio período";
  }
  if (t.includes("plantao") || t.includes("turno")) return "Plantão";
  if (
    t.includes("pj") ||
    t.includes("pessoa juridica") ||
    t.includes("autonomo") ||
    t.includes("mei") ||
    t.includes("prestacao") ||
    t.includes("recibo") ||
    t.includes("avenca")
  ) {
    return "PJ";
  }
  if (t.includes("estagio") || t.includes("trainee")) return "Estágio";
  if (
    t.includes("clt") ||
    t.includes("efetivo") ||
    t.includes("efectivo") ||
    t.includes("carteira") ||
    t.includes("inteiro") ||
    t.includes("full") ||
    t.includes("indeterminado") ||
    t.includes("sem termo") ||
    t.includes("completo")
  ) {
    return "CLT";
  }
  if (
    t.includes("temporario") ||
    t.includes("contrato") ||
    t.includes("termo") ||
    t.includes("prazo determinado")
  ) {
    return "Temporário";
  }
  return "Temporário";
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
  const q = query.trim().toLocaleLowerCase("pt-BR");
  if (!q) return 0;
  const title = job.title.toLocaleLowerCase("pt-BR");
  const company = job.company.toLocaleLowerCase("pt-BR");
  const profession = job.profession.toLocaleLowerCase("pt-BR");
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (profession.includes(q)) return 40;
  if (company.includes(q)) return 25;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => title.includes(w))) return 50;
  if (job.description) {
    const desc = job.description.toLocaleLowerCase("pt-BR");
    if (desc.includes(q)) return 15;
    if (words.length > 1 && words.every((w) => desc.includes(w))) return 10;
  }
  return 0;
}
