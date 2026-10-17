import type { Job } from "@/lib/jobs";

/**
 * Fontes de notícias/editais de concursos (não são vagas de um empregador).
 * Não levam JobPosting, não entram no sitemap e ficam noindex até existir
 * uma secção própria de concursos. O texto da fonte não é republicado.
 */
const CONCURSO_SOURCES = new Set(["pci_concursos", "inca"]);

export function isConcursoJob(job: Pick<Job, "source">) {
  return Boolean(job.source && CONCURSO_SOURCES.has(job.source));
}

const HEALTH_CARGO_RE =
  /enferm|m[eé]dic|odont|dentista|sa[uú]de bucal|fisioterap|nutri|psic[oó]log|farmac|fonoaudi|biom[eé]dic|radiolog|terapeuta|assistente social|agente comunit[aá]ri|agente de (?:combate|endemias|sa[uú]de)|socorr|ambul[aâ]ncia|laborat[oó]ri|veterin|sanit[aá]ri|cuidador/i;

/** Nomes dos cargos de saúde listados na notícia (factos, não o texto). */
export function extractHealthCargos(description: string, limit = 12) {
  const cargos: string[] = [];
  for (const raw of description.split("\n")) {
    const line = raw.trim();
    if (!/^[-•*]/.test(line)) continue;
    const cargo = line.replace(/^[-•*]\s*/, "").trim();
    if (cargo.length < 4 || cargo.length > 90) continue;
    if (!HEALTH_CARGO_RE.test(cargo)) continue;
    if (!cargos.includes(cargo)) cargos.push(cargo);
    if (cargos.length >= limit) break;
  }
  return cargos;
}

function formatDateBR(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Resumo original do concurso a partir dos campos estruturados. */
export function buildConcursoSummary(job: Job) {
  const deadline = formatDateBR(job.expiresAt);
  const parts = [
    `Concurso público ou processo seletivo de ${job.company}${job.district ? ` (${job.district})` : ""}.`,
  ];
  if (deadline) parts.push(`Inscrições até ${deadline}.`);
  if (job.salary) parts.push(`Remuneração a partir de ${job.salary}, conforme o edital.`);
  parts.push(
    "Consulte o edital completo para requisitos, número de vagas, taxa de inscrição e cronograma.",
  );
  return {
    description: parts.join(" "),
    cargos: extractHealthCargos(job.description),
  };
}
