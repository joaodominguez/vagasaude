/**
 * Utilitários de apresentação da vaga (página e cartão). Funções puras:
 * nunca devolvem «A definir» nem valores vazios.
 */
import type { Job } from "@/lib/jobs";
import { foldText } from "@/lib/display-title";
import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { parseAnnouncedSalary } from "@/lib/seo";

const EMPTY_VALUES = new Set([
  "",
  "a combinar",
  "contrato",
  "a definir",
  "nao indicado",
  "nao especificado",
  "nao disponivel",
  "n/d",
  "n.d.",
  "nd",
  "-",
  "—",
]);

/** Valor útil (nem vazio nem «A combinar»), ou null. */
export function knownValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return EMPTY_VALUES.has(foldText(text)) ? null : text;
}

/** Tipo de contrato só quando se conhece. */
export function knownContract(job: Pick<Job, "contract">): string | null {
  return knownValue(job.contract);
}

/** Contratos que na verdade descrevem o horário («Turnos», «Tempo inteiro», «Part-time»): vão em «Horário». */
export const SCHEDULE_AS_CONTRACT =
  /^(turnos?|turno (?:da )?(?:manha|tarde|noite)|full[- ]?time|part[- ]?time|tempo inteiro|tempo completo|tempo parcial|meio periodo|horario (?:completo|parcial)|laboracao continua)$/;

/**
 * Contrato a mostrar junto ao tipo de vaga: omite-se quando repete a mesma palavra
 * («Bolsa de recrutamento» + «Bolsa de recrutamento») ou quando descreve o horário.
 * Nas vagas «tempo inteiro» mantém-se, como na maqueta.
 */
export function contractBesideType(
  job: Pick<Job, "contract" | "title" | "description" | "sector" | "source">,
): string | null {
  const contract = knownContract(job);
  if (!contract) return null;
  const folded = foldText(contract).trim();
  if (/^(turnos?|turno |laboracao)/.test(folded)) return null;
  const type = classifyJob(job);
  if (type === "oferta") return contract;
  const b = foldText(JOB_TYPE_LABEL[type]).trim();
  return folded === b || b.includes(folded) ? null : contract;
}

/** «hoje», «ontem», «há 3 dias», «há 2 meses» (minúsculas, para compor frases). */
export function relativePublished(publishedAt: string, now = Date.now()): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "há 1 mês" : `há ${months} meses`;
  return `a ${date.toLocaleDateString("pt-PT")}`;
}

/** «Publicada hoje» / «Publicada há 3 dias» (ou null se a data for inválida). */
export function publishedSentence(publishedAt: string): string | null {
  const rel = relativePublished(publishedAt);
  return rel ? `Publicada ${rel}` : null;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function lisbonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** «17 nov 2026» (meses escritos à mão: não depende dos dados de locale do servidor). */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { day, month, year } = lisbonParts(date);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** «19 nov» (sem ano, para prazos curtos). */
function dayMonth(date: Date): string {
  const { day, month } = lisbonParts(date);
  return `${day} ${MONTHS[month - 1]}`;
}

/**
 * Prazo breve: «Até 19 nov» quando a fonte indica uma data futura.
 * Para prazos passados não mostra nada.
 */
export function deadlineLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  // Tolerância até ao fim do dia da data-limite.
  if (date.getTime() + 86_400_000 < now) return null;
  return `Até ${dayMonth(date)}`;
}

const UNIT_LABEL = { MONTH: "/mês", HOUR: "/hora", DAY: "/dia", YEAR: "/ano" } as const;

function formatAmount(value: number) {
  // Espaço inseparável como separador de milhares: «1 499».
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Remuneração real indicada, formatada («1 499 €/mês»); null se a vaga não a tiver. */
export function announcedSalaryLabel(salary: string | null | undefined): string | null {
  const parsed = parseAnnouncedSalary(salary);
  if (!parsed) return null;
  const gross = /brut[oa]s?|ilíquid/i.test(salary ?? "");
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
 * Itens de lista (requisitos/responsabilidades) que acrescentam algo à descrição.
 * Devolve [] quando metade ou mais já consta da descrição, ou coincide com `exclude`.
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
 * Excerto truncado pela fonte («...» / «…» no fim): corta na última frase completa
 * (ou na última palavra, a fechar com «.»). `truncated` indica se havia corte.
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

/** Empresas «genéricas» de agregadores (IEFP/SNE, ordens): não são o empregador real. */
const GENERIC_COMPANY_RE = /^(?:entidade anunciante|empresa anunciante|oferta (?:via|do|da)|ofertas? de emprego via|anunciante|confidencial)/i;

/**
 * Nome da entidade a mostrar. Se vem do IEFP/SNE ou de um anúncio sem empregador identificado,
 * não se apresenta como empregador: «Entidade não indicada · via IEFP».
 */
export function companyDisplay(company: string | null | undefined): { label: string; generic: boolean } {
  const text = (company ?? "").trim();
  if (!text) return { label: "Entidade não indicada", generic: true };
  if (!GENERIC_COMPANY_RE.test(text)) return { label: text, generic: false };
  if (/\biefp\b|\bsne\b|servico nacional de emprego|emprego e formacao/i.test(foldText(text))) {
    return { label: "Entidade não indicada · via IEFP", generic: true };
  }
  if (/confidencial/i.test(text)) return { label: "Entidade confidencial", generic: true };
  return { label: "Entidade não indicada", generic: true };
}
