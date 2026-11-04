import type { Job } from "@/lib/jobs";

/**
 * Tipo de oferta. "oferta" é o valor por defeito (emprego privado, ou público
 * por CLT/organização social sem concurso ou processo seletivo identificável).
 */
export type JobType = "concurso" | "processo-seletivo" | "residencia" | "oferta";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  concurso: "Concurso público",
  "processo-seletivo": "Processo seletivo",
  residencia: "Residência",
  oferta: "Vaga de emprego",
};

/** Tipos listados em /concursos (só seleção pública com edital). */
export const CONCURSOS_TYPES: readonly JobType[] = [
  "concurso",
  "processo-seletivo",
  "residencia",
];

/**
 * Fontes que publicam editais de seleção pública (prefeituras, secretarias,
 * universidades, EBSERH, INCA, AgSUS…). As organizações sociais (SPDM, IRSSL…)
 * aparecem com setor "Público" mas contratam por CLT: só contam se o título
 * disser explicitamente que é concurso ou processo seletivo.
 */
const EDITAL_SOURCES = new Set(["pci_concursos", "inca", "agsus"]);

function norm(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPublicJob(job: Pick<Job, "sector" | "source">) {
  return (
    job.sector === "Público" ||
    Boolean(job.source && EDITAL_SOURCES.has(job.source))
  );
}

const RESIDENCIA_RE =
  /\bresidencias?\b|\benare\b|residencia (medica|multiprofissional|uniprofissional|em saude)/;
const PSS_RE =
  /processo seletivo|\bpss\b|selecao publica|chamamento publico|selecao simplificada|processo simplificado/;
const CONCURSO_RE = /\bconcursos?\b|\bcpnu\b/;

type TypeInput = Pick<Job, "title" | "sector" | "source" | "sourceId">;

const typeCache = new WeakMap<object, JobType>();

/**
 * Classifica a oferta. Só o setor público pode ser concurso, processo seletivo
 * ou residência; o resto é sempre "oferta". Usa só campos leves (título e id da
 * fonte), porque a lista em memória não traz a descrição.
 */
export function classifyJob(job: TypeInput): JobType {
  const cached = typeCache.get(job);
  if (cached) return cached;
  const type = classifyUncached(job);
  typeCache.set(job, type);
  return type;
}

function classifyUncached(job: TypeInput): JobType {
  if (!isPublicJob(job)) return "oferta";
  const title = norm(job.title);
  const id = norm(job.sourceId ?? "");

  if (RESIDENCIA_RE.test(title)) return "residencia";
  if (PSS_RE.test(title)) return "processo-seletivo";
  if (CONCURSO_RE.test(title)) return "concurso";

  const source = job.source ?? "";
  if (EDITAL_SOURCES.has(source)) {
    // PCI Concursos: o título do cargo não diz o tipo, o slug da notícia sim.
    if (PSS_RE.test(id) && !CONCURSO_RE.test(id)) return "processo-seletivo";
    if (source === "agsus") return "processo-seletivo";
    if (source === "pci_concursos") return "concurso";
  }
  return "oferta";
}

/** Pertence a /concursos? (concurso, processo seletivo ou residência públicos). */
export function isConcursoListing(job: TypeInput) {
  return CONCURSOS_TYPES.includes(classifyJob(job));
}
