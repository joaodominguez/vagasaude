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
  "a definir",
  "a combinar",
  "nao informado",
  "nao especificado",
  "nao disponivel",
  "n/d",
  "n.d.",
  "nd",
  "-",
  "—",
  "none",
  "null",
]);

/** Valor útil (não vazio e não «A definir»), ou null. */
export function knownValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return EMPTY_VALUES.has(foldText(text)) ? null : text;
}

/** Tipo de contrato só quando é conhecido. */
export function knownContract(job: Pick<Job, "contract">): string | null {
  return knownValue(job.contract);
}

/** Contratos que na verdade descrevem o horário («Plantão», «Meio período»…): vão para «Horário». */
const SCHEDULE_AS_CONTRACT = /^(plantao|turnos?|diarista|meio periodo|tempo integral|periodo integral|part[- ]?time|full[- ]?time)$/;

const EDITAL_AS_CONTRACT = /^(concurso(?: publico)?|pss|processo seletivo|residencia|selecao publica)$/;

/**
 * Contrato a mostrar ao lado do tipo de vaga: omitido quando repete a mesma palavra
 * («Concurso» + «Concurso público»), para não ter duas etiquetas iguais.
 */
export function contractBesideType(
  job: Pick<Job, "contract" | "title" | "sector" | "source" | "sourceId">,
): string | null {
  const contract = knownContract(job);
  if (!contract) return null;
  if (SCHEDULE_AS_CONTRACT.test(foldText(contract).trim())) return null;
  const type = classifyJob(job);
  if (type === "oferta") return contract;
  // Em editais, «Concurso»/«PSS»/«Residência» como contrato repete o tipo.
  if (EDITAL_AS_CONTRACT.test(foldText(contract).trim())) return null;
  const a = foldText(contract).trim();
  const b = foldText(JOB_TYPE_LABEL[type]).trim();
  return a === b || b.includes(a) ? null : contract;
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
  return `em ${date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;
}

/** «Publicada hoje» / «Publicada há 3 dias» (ou null se a data não for válida). */
export function publishedSentence(publishedAt: string): string | null {
  const rel = relativePublished(publishedAt);
  return rel ? `Publicada ${rel}` : null;
}

/** «17 nov. 2026» → «17 nov 2026». */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

function dayMonth(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

/**
 * Prazo curto: «Inscrições até 19 nov» quando a fonte indica uma data futura.
 * Para prazos já passados não mostra nada.
 */
export function deadlineLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  // Tolerância até ao fim do dia da data limite.
  if (date.getTime() + 86_400_000 < now) return null;
  return `Inscrições até ${dayMonth(date)}`;
}

const UNIT_LABEL = { MONTH: "/mês", HOUR: "/hora", DAY: "/dia", WEEK: "/semana", YEAR: "/ano" } as const;

function formatAmount(value: number) {
  // Ponto como separador de milhares: «1.499».
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Remuneração real anunciada, formatada («R$ 1.499/mês»); null se a vaga não tem. */
export function announcedSalaryLabel(salary: string | null | undefined): string | null {
  const parsed = parseAnnouncedSalary(salary);
  if (!parsed) return null;
  const unit = UNIT_LABEL[parsed.unitText];
  if (parsed.minValue != null && parsed.maxValue != null) {
    return `R$ ${formatAmount(parsed.minValue)}–${formatAmount(parsed.maxValue)}${unit}`;
  }
  if (parsed.value != null) return `R$ ${formatAmount(parsed.value)}${unit}`;
  return null;
}

function squash(text: string) {
  return foldText(text).replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Itens de lista (requisitos/responsabilidades) que acrescentam algo à descrição.
 * Devolve [] quando metade ou mais já está na descrição, ou coincide com `exclude`.
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
 * Trecho truncado pela fonte («...» / «…» no fim): corta na última frase completa
 * (ou na última palavra, fechando com «.»). `truncated` indica se havia corte.
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
