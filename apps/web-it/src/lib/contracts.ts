import { foldText, lightText, parseQuery, stemmedHasAll, stemmedText } from "@/lib/search-text";
/** Normalizza i tipi di contratto per filtri stabili. */
export const CONTRACT_FILTERS = [
  "Tempo pieno",
  "Part-time",
  "Turni",
  "Libero professionale",
  "Tempo indeterminato",
  "Tempo determinato",
] as const;

export type ContractFilter = (typeof CONTRACT_FILTERS)[number];

/** Valore quando la fonte non indica il tipo di contratto. */
export const CONTRACT_UNKNOWN = "Non specificato";

export function contractBucket(contract: string | null | undefined): string {
  const raw = (contract || "").trim();
  if (!raw || raw === CONTRACT_UNKNOWN) return CONTRACT_UNKNOWN;
  const t = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("it");

  if (t.includes("part-time") || t.includes("part time") || t.includes("parttime")) {
    return "Part-time";
  }
  if (t.includes("turni") || t.includes("turno") || t.includes("reperibil")) return "Turni";
  if (
    t.includes("libero profession") ||
    t.includes("libera profession") ||
    t.includes("partita iva") ||
    t.includes("p.iva") ||
    t.includes("consulenza") ||
    t.includes("co.co.co") ||
    t.includes("collaborazione") ||
    t.includes("freelance")
  ) {
    return "Libero professionale";
  }
  if (t.includes("indeterminat") || t.includes("a tempo pieno e indeterminato")) {
    return "Tempo indeterminato";
  }
  if (
    t.includes("determinat") ||
    t.includes("sostituzione") ||
    t.includes("incarico a tempo")
  ) {
    return "Tempo determinato";
  }
  if (t.includes("full-time") || t.includes("full time") || t.includes("tempo pieno")) {
    return "Tempo pieno";
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
  const q = parseQuery(query, "it");
  if (!q.folded) return 0;
  const title = foldText(job.title, "it");
  const company = foldText(job.company, "it");
  const profession = foldText(job.profession, "it");
  if (title === q.folded) return 100;
  if (title.startsWith(q.folded)) return 80;
  if (title.includes(q.folded)) return 60;
  if (profession.includes(q.folded)) return 40;
  if (company.includes(q.folded)) return 25;
  const multi = q.stems.length > 1;
  if (multi && stemmedHasAll(stemmedText(job.title, "it"), q)) return 50;
  if (stemmedHasAll(stemmedText(job.title, "it"), q)) return 45;
  if (job.description) {
    if (foldText(job.description, "it").includes(q.folded)) return 15;
    if (multi && stemmedHasAll(lightText(job.description, "it"), q)) return 10;
  }
  return 0;
}
