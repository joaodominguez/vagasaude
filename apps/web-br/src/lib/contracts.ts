import { foldText, lightText, parseQuery, stemmedHasAll, stemmedText } from "@/lib/search-text";
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
    if (multi && stemmedHasAll(lightText(job.description, "pt"), q)) return 10;
  }
  return 0;
}
