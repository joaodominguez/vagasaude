import type { Job } from "@/lib/jobs";
import { SOURCE_META } from "@/lib/sources";

/**
 * Tipo de oferta. "oferta" é o valor por omissão (emprego privado/IPSS, ou
 * emprego público sem procedimento concursal identificável).
 */
export type JobType = "concurso" | "bolsa" | "mobilidade" | "manifestacao" | "oferta";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  concurso: "Concurso",
  bolsa: "Bolsa de recrutamento",
  mobilidade: "Mobilidade",
  manifestacao: "Manifestação de interesse",
  oferta: "Oferta de emprego",
};

/** Tipos listados em /concursos (só emprego público com procedimento de recrutamento). */
export const CONCURSOS_TYPES: readonly JobType[] = [
  "concurso",
  "bolsa",
  "mobilidade",
  "manifestacao",
];

/** Fontes que publicam exclusivamente procedimentos de recrutamento público (BEP, DRE, ULS…). */
const OFFICIAL_SOURCES = new Set([
  "bep",
  "dre",
  "inem",
  "ipst",
  "sesaram",
  "ipo_porto",
  "uls_sao_jose",
  "uls_coimbra",
  "uls_sao_joao",
]);

function norm(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isPublicJob(job: Pick<Job, "sector" | "source">) {
  if (job.sector === "Público") return true;
  const source = job.source?.toLowerCase();
  if (!source) return false;
  return OFFICIAL_SOURCES.has(source) || SOURCE_META[source]?.sector === "Público";
}

// Padrões sobre texto normalizado (sem acentos, minúsculas).
/** Avisos de resultado (lista final, homologação, anulação, contratação de pessoa concreta): não são concursos abertos. */
const OUTCOME_RE =
  /\blistas? (unitaria )?de (classificacao|ordenacao)|\bhomologa|\banulacao\b|\bdeserto\b|^contratacao de [^,]{3,60} em regime de|^(designacao|nomeacao|cessacao|exoneracao)\b|\bprovimento de\b/;
const MOBILIDADE_RE =
  /\bmobilidade (interna|intercarreiras|intercategorias|na categoria|na carreira|geral)|\bcedencia de interesse publico/;
const MANIFESTACAO_RE =
  /\bmanifestac(ao|oes) de interesse|\bacolhimento de manifestac/;
const BOLSA_RE =
  /\bbolsas? de (recrutamento|reservas?|candidatos)|\breservas? de recrutamento|\bconstituicao de (bolsa|reserva)/;
const CONCURSO_RE =
  /\bprocedimento(s)? concursal|\bconcurso(s)?\b|\baviso \(extrato\)|\brecrutamento (de|para)\b|\bpostos? de trabalho\b/;

const typeCache = new WeakMap<object, JobType>();

/**
 * Classifica a oferta. Só o emprego público pode ser concurso, bolsa,
 * mobilidade ou manifestação de interesse; o resto é sempre "oferta".
 *
 * 1. Avisos de resultado (listas finais, homologações, anulações) ficam
 *    "oferta": já não há candidaturas abertas.
 * 2. Prioridade: mobilidade > manifestação > bolsa > concurso, porque um título
 *    "procedimento concursal para constituição de bolsa…" é uma bolsa.
 * 3. Texto: título e arranque da descrição (evita menções incidentais).
 * 4. Fontes oficiais de recrutamento (BEP, DRE, ULS…) sem outro sinal: concurso.
 */
export function classifyJob(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
): JobType {
  const cached = typeCache.get(job);
  if (cached) return cached;
  const type = classifyUncached(job);
  typeCache.set(job, type);
  return type;
}

function classifyUncached(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
): JobType {
  if (!isPublicJob(job)) return "oferta";

  const title = norm(job.title);
  const lead = norm(job.description ?? "").slice(0, 400);
  const text = `${title} | ${lead}`;

  if (OUTCOME_RE.test(title) || OUTCOME_RE.test(lead.slice(0, 220))) return "oferta";
  if (MOBILIDADE_RE.test(text)) return "mobilidade";
  if (MANIFESTACAO_RE.test(text)) return "manifestacao";
  if (BOLSA_RE.test(text)) return "bolsa";
  if (CONCURSO_RE.test(text)) return "concurso";
  if (OFFICIAL_SOURCES.has(job.source?.toLowerCase() ?? "")) return "concurso";
  return "oferta";
}

/** Pertence a /concursos? (concurso, bolsa, mobilidade ou manifestação de interesse públicos). */
export function isConcursoJob(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
) {
  return CONCURSOS_TYPES.includes(classifyJob(job));
}
