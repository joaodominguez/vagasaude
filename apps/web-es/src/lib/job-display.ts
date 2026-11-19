/**
 * Utilidades de presentación de la oferta (página y tarjeta). Funciones puras:
 * nunca devuelven «A convenir» ni valores vacíos.
 */
import type { Job } from "@/lib/jobs";
import { foldText } from "@/lib/display-title";
import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { parseAnnouncedSalary } from "@/lib/seo";

const EMPTY_VALUES = new Set([
  "",
  "a convenir",
  "no indicado",
  "no especificado",
  "sin especificar",
  "no disponible",
  "n/d",
  "n.d.",
  "nd",
  "-",
  "—",
]);

/** Valor útil (ni vacío ni «A convenir»), o null. */
export function knownValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return EMPTY_VALUES.has(foldText(text)) ? null : text;
}

/** Tipo de contrato solo cuando se conoce. */
export function knownContract(job: Pick<Job, "contract">): string | null {
  return knownValue(job.contract);
}

/**
 * Contrato a mostrar junto al tipo de oferta: se omite cuando repite la misma palabra
 * («Bolsa de empleo» + «Bolsa de empleo»), para no tener dos chips iguales.
 */
export function contractBesideType(
  job: Pick<Job, "contract" | "title" | "description" | "sector" | "source">,
): string | null {
  const contract = knownContract(job);
  if (!contract) return null;
  if (SCHEDULE_AS_CONTRACT.test(foldText(contract).trim())) return null;
  const type = classifyJob(job);
  if (type === "oferta") return contract;
  const a = foldText(contract).trim();
  const b = foldText(JOB_TYPE_LABEL[type]).trim();
  return a === b || b.includes(a) ? null : contract;
}

/** «hoy», «ayer», «hace 3 días», «hace 2 meses» (minúscula, para componer frases). */
export function relativePublished(publishedAt: string, now = Date.now()): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
  return `el ${date.toLocaleDateString("es-ES")}`;
}

/** «Publicada hoy» / «Publicada hace 3 días» (o null si la fecha no es válida). */
export function publishedSentence(publishedAt: string): string | null {
  const rel = relativePublished(publishedAt);
  return rel ? `Publicada ${rel}` : null;
}

/** «17 nov 2026». */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

/** «19 nov» (sin año, para plazos cortos). */
function dayMonth(date: Date): string {
  return date
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

/**
 * Plazo breve: «Hasta el 19 nov» cuando la fuente indica una fecha futura.
 * Para plazos pasados no muestra nada.
 */
export function deadlineLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  // Tolerancia hasta el final del día de la fecha límite.
  if (date.getTime() + 86_400_000 < now) return null;
  return `Hasta el ${dayMonth(date)}`;
}

const UNIT_LABEL = { MONTH: "/mes", HOUR: "/hora", DAY: "/día", YEAR: "/año" } as const;

/** Contratos que en realidad describen la jornada («Turnos», «Jornada completa», «Media jornada»): van en «Horario». */
export const SCHEDULE_AS_CONTRACT = /^(turnos?|turno (?:de )?(?:manana|tarde|noche)|full[- ]?time|part[- ]?time|jornada completa|jornada parcial|tiempo completo|tiempo parcial|media jornada|jornada reducida)$/;

function formatAmount(value: number) {
  // Punto como separador de miles (es-ES): «1.499».
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Retribución real indicada, formateada («1.499 €/mes»); null si la oferta no la tiene. */
export function announcedSalaryLabel(salary: string | null | undefined): string | null {
  const parsed = parseAnnouncedSalary(salary);
  if (!parsed) return null;
  const gross = /brut[oa]s?/i.test(salary ?? "");
  const unit = (gross ? " brutos" : "") + UNIT_LABEL[parsed.unitText];
  if (parsed.minValue != null && parsed.maxValue != null) {
    return `${formatAmount(parsed.minValue)}–${formatAmount(parsed.maxValue)} €${unit}`;
  }
  if (parsed.value != null) return `${formatAmount(parsed.value)} €${unit}`;
  return null;
}

function squash(text: string) {
  return foldText(text).replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Elementos de lista (requisitos/funciones) que aportan algo a la descripción.
 * Devuelve [] cuando la mitad o más ya está en la descripción, o coincide con `exclude`.
 */
export function distinctItems(
  items: string[],
  description: string,
  exclude: string[] = [],
): string[] {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const desc = squash(description);
  const excluded = new Set(exclude.map(squash));
  const fresh = clean.filter((item) => {
    const key = squash(item);
    if (!key || excluded.has(key)) return false;
    return !desc.includes(key);
  });
  return fresh.length * 2 > clean.length ? clean.filter((i) => !excluded.has(squash(i))) : [];
}

/**
 * Extracto truncado por la fuente («...» / «…» al final): corta en la última frase completa
 * (o en la última palabra, cerrando con «.»). `truncated` indica si había corte.
 */
export function trimTruncatedExcerpt(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (!/(\.{3}|…)$/.test(trimmed)) return { text, truncated: false };
  const body = trimmed.replace(/(\.{3}|…)+$/, "").trimEnd();
  const lastStop = Math.max(body.lastIndexOf("."), body.lastIndexOf("!"), body.lastIndexOf("?"));
  if (lastStop > 0) return { text: body.slice(0, lastStop + 1), truncated: true };
  const lastSpace = body.lastIndexOf(" ");
  const cut = (lastSpace > 0 ? body.slice(0, lastSpace) : body).replace(/[,;:\s-]+$/, "");
  return { text: `${cut}.`, truncated: true };
}

/** Empresas «genéricas» de agregadores (SNE, colegios profesionales): no son el empleador real. */
const GENERIC_COMPANY_RE = /^(?:empresa anunciante|oferta v[ií]a|ofertas? de empleo v[ií]a|anunciante)/i;

/**
 * Nombre de empresa para mostrar. Si viene del SNE o de una bolsa de un colegio profesional,
 * no se presenta como empleador: «Empresa no indicada · vía SNE» / «Vía Colegio de Médicos…».
 */
export function companyDisplay(company: string | null | undefined): { label: string; generic: boolean } {
  const text = (company ?? "").trim();
  if (!text) return { label: "Empresa no indicada", generic: true };
  if (!GENERIC_COMPANY_RE.test(text)) return { label: text, generic: false };
  if (/sistema nacional de empleo|\bsne\b/i.test(text)) {
    return { label: "Empresa no indicada · vía SNE", generic: true };
  }
  const via = text.replace(/^oferta\s+/i, "").replace(/^v[ií]a/i, "vía");
  return { label: `Oferta ${via}`, generic: true };
}
