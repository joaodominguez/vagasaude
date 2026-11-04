import type { Job } from "@/lib/jobs";
import { SOURCE_META } from "@/lib/sources";

/**
 * Tipo de oferta. "oferta" es el valor por defecto (empleo privado o público
 * sin proceso selectivo identificable).
 */
export type JobType = "oposicion" | "bolsa" | "traslado" | "temporal" | "oferta";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  oposicion: "Oposición",
  bolsa: "Bolsa de empleo",
  traslado: "Concurso de traslados",
  temporal: "Contratación temporal",
  oferta: "Oferta de empleo",
};

/** Tipos que se muestran en /oposiciones (solo empleo público con proceso selectivo). */
export const OPOSICIONES_TYPES: readonly JobType[] = ["oposicion", "bolsa", "traslado"];

/** Fuentes que publican exclusivamente empleo público aunque el sector no llegue informado. */
const PUBLIC_SOURCES = new Set(["boe"]);

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
  return PUBLIC_SOURCES.has(source) || SOURCE_META[source]?.sector === "Público";
}

// Patrones sobre texto normalizado (sin tildes, minúsculas).
const TRASLADO_RE =
  /concurso(s)? (general |abierto y permanente )?de (traslados?|movilidad)|concurso de provision|movilidad (interna|voluntaria)|traslado(s)? (voluntario|de personal)/;
const BOLSA_RE =
  /bolsa(s)? (unica )?(de (empleo|trabajo|contratacion|personal|interinos?)|abierta)|lista(s)? (de )?(espera|contratacion|empleo|reserva)|bolsa de empleo temporal/;
const OPOSICION_RE =
  /\boposicion(es)?\b|\bope\b|proceso(s)? selectivo(s)?|prueba(s)? selectiva(s)?|oferta(s)? de empleo publico|concurso[- ]oposicion|turno libre|promocion interna|estabilizacion|acceso (a la condicion de|como) personal|personal (estatutario|funcionario|laboral) fijo|plaza(s)? de (personal )?(estatutario|funcionario) fijo/;
const TEMPORAL_RE =
  /contratacion temporal|nombramiento (de personal )?(interino|eventual|temporal)|personal (interino|eventual)|interinidad|sustitucion/;

/**
 * Clasifica la oferta por tipo. Solo el empleo público puede ser oposición,
 * bolsa, traslado o contratación temporal; el resto es siempre "oferta".
 *
 * 1. Títulos nuevos: empiezan por la palabra de tipo ("Oposición …", "OPE …",
 *    "Bolsa de empleo …", "Concurso de traslados …", "Contratación temporal …").
 * 2. Títulos largos oficiales (BOE/boletines autonómicos): patrones en el título.
 * 3. Último recurso: patrones fuertes en el arranque de la descripción y, para
 *    fuentes de listas de contratación, el tipo de la fuente.
 * Orden de prioridad: traslado > bolsa > oposición > temporal, porque un
 * título de traslados/bolsas puede mencionar "personal estatutario fijo".
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

const typeCache = new WeakMap<object, JobType>();

function classifyUncached(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
): JobType {
  if (!isPublicJob(job)) return "oferta";

  const title = norm(job.title);

  // 1) Prefijo explícito.
  if (/^(oposicion(es)?|ope)\b/.test(title)) return "oposicion";
  if (/^bolsas? de (empleo|trabajo)\b/.test(title)) return "bolsa";
  if (/^concurso(s)? de (traslados?|movilidad)\b/.test(title)) return "traslado";
  if (/^contratacion temporal\b/.test(title)) return "temporal";

  // 2) Título oficial largo.
  const byTitle = matchPatterns(title);
  if (byTitle) return byTitle;

  // 3) Descripción (solo el arranque, para evitar menciones incidentales).
  const lead = norm(job.description).slice(0, 400);
  const byLead = matchPatterns(lead, true);
  if (byLead) return byLead;

  // 4) Fuente de listas de contratación temporal (p. ej. Osakidetza).
  const sourceName = norm(SOURCE_META[job.source?.toLowerCase() ?? ""]?.name ?? "");
  if (/listas? de contratacion temporal/.test(sourceName)) return "temporal";

  return "oferta";
}

function matchPatterns(text: string, strictOnly = false): JobType | null {
  if (TRASLADO_RE.test(text)) return "traslado";
  if (strictOnly) {
    if (/bolsa(s)? (unica )?de (empleo|trabajo)\b/.test(text)) return "bolsa";
    // En la descripción solo vale lo inequívoco.
    if (/proceso(s)? selectivo(s)?|pruebas? selectivas?|concurso[- ]oposicion|\boposicion(es)?\b/.test(text)) {
      return "oposicion";
    }
    return null;
  }
  if (BOLSA_RE.test(text)) return "bolsa";
  if (OPOSICION_RE.test(text)) return "oposicion";
  if (TEMPORAL_RE.test(text)) return "temporal";
  return null;
}

/** ¿Pertenece a /oposiciones? (oposición, bolsa o concurso de traslados públicos). */
export function isOposicionJob(job: Pick<Job, "title" | "description" | "sector" | "source">) {
  return OPOSICIONES_TYPES.includes(classifyJob(job));
}
