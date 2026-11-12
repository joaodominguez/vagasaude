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
  const q = query.trim().toLocaleLowerCase("it");
  if (!q) return 0;
  const title = job.title.toLocaleLowerCase("it");
  const company = job.company.toLocaleLowerCase("it");
  const profession = job.profession.toLocaleLowerCase("it");
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (profession.includes(q)) return 40;
  if (company.includes(q)) return 25;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => title.includes(w))) return 50;
  if (job.description) {
    const desc = job.description.toLocaleLowerCase("it");
    if (desc.includes(q)) return 15;
    if (words.length > 1 && words.every((w) => desc.includes(w))) return 10;
  }
  return 0;
}
