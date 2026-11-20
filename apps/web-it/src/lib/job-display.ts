/**
 * Utilità di presentazione dell'offerta (pagina e scheda). Funzioni pure:
 * non restituiscono mai «Da definire» né valori vuoti.
 */
import type { Job } from "@/lib/jobs";
import { foldText } from "@/lib/display-title";
import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { parseAnnouncedSalary } from "@/lib/seo";

const EMPTY_VALUES = new Set([
  "",
  "da definire",
  "da definirsi",
  "non indicato",
  "non specificato",
  "non disponibile",
  "n/d",
  "n.d.",
  "nd",
  "-",
  "—",
]);

/** Valore utile (non vuoto e non «Da definire»), oppure null. */
export function knownValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return EMPTY_VALUES.has(foldText(text)) ? null : text;
}

/** Tipo di contratto solo quando è noto. */
export function knownContract(job: Pick<Job, "contract">): string | null {
  return knownValue(job.contract);
}

/**
 * Contratto da mostrare accanto al tipo di offerta: omesso quando ripete la stessa parola
 * («Supplenza» + «Supplenza»), per non avere due chip uguali.
 */
export function contractBesideType(
  job: Pick<Job, "contract" | "title" | "description" | "sector" | "source">,
): string | null {
  const contract = knownContract(job);
  if (!contract) return null;
  if (SCHEDULE_AS_CONTRACT.test(foldText(contract).trim())) return null;
  const type = classifyJob(job);
  if (type === "offerta") return contract;
  const a = foldText(contract).trim();
  const b = foldText(JOB_TYPE_LABEL[type]).trim();
  return a === b || b.includes(a) ? null : contract;
}

/** «oggi», «ieri», «3 giorni fa», «2 mesi fa» (minuscolo, per comporre frasi). */
export function relativePublished(publishedAt: string, now = Date.now()): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 mese fa" : `${months} mesi fa`;
  return `il ${date.toLocaleDateString("it-IT")}`;
}

/** «Pubblicata oggi» / «Pubblicata 3 giorni fa» (o null se la data non è valida). */
export function publishedSentence(publishedAt: string): string | null {
  const rel = relativePublished(publishedAt);
  return rel ? `Pubblicata ${rel}` : null;
}

/** «17 nov 2026». */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" })
    .replace(/\./g, "");
}

/** «19 nov» (senza anno, per le scadenze brevi). */
function dayMonth(date: Date): string {
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" }).replace(/\./g, "");
}

/**
 * Scadenza breve: «Scade il 19 nov» quando la fonte indica una data futura.
 * Per le scadenze passate non mostra nulla.
 */
export function deadlineLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  // Tolleranza fino a fine giornata della data di scadenza.
  if (date.getTime() + 86_400_000 < now) return null;
  const day = date.getDate();
  // «Scade l'8 dic», «Scade l'11 nov», «Scade il 19 nov».
  return `Scade ${day === 8 || day === 11 ? "l'" : "il "}${dayMonth(date)}`;
}

const ROME_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" });

/** Giorno di calendario (fuso Europe/Rome) come numero di giorni dall'epoca. */
function romeDayNumber(time: number): number {
  const [y, m, d] = ROME_DAY.format(time).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Giorni di calendario (Roma) da oggi alla scadenza: 0 = oggi, negativo = scaduta; null se manca la data. */
export function daysUntilDeadline(
  expiresAt: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!expiresAt) return null;
  const time = Date.parse(expiresAt);
  if (Number.isNaN(time)) return null;
  return romeDayNumber(time) - romeDayNumber(now);
}

/**
 * Scadenza con conto alla rovescia: «Scade il 27/11 · tra 5 giorni», «Scade oggi», «Scade domani».
 * null per scadenze passate o assenti. Il conto alla rovescia compare solo entro 60 giorni.
 */
export function deadlineCountdownLabel(
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  const days = daysUntilDeadline(expiresAt, now);
  if (days === null || days < 0) return null;
  if (days === 0) return "Scade oggi";
  if (days === 1) return "Scade domani";
  const [, m, d] = ROME_DAY.format(Date.parse(expiresAt as string)).split("-").map(Number);
  const prefix = `Scade ${d === 8 || d === 11 ? "l'" : "il "}${d}/${String(m).padStart(2, "0")}`;
  return days <= 60 ? `${prefix} · tra ${days} giorni` : prefix;
}

const UNIT_LABEL = { MONTH: "/mese", HOUR: "/ora", DAY: "/giorno", YEAR: "/anno" } as const;

/** Contratti che in realtà descrivono l'orario («Turni», «Full-time», «Part-time»): vanno in «Orario». */
const SCHEDULE_AS_CONTRACT = /^(turni|full[- ]?time|part[- ]?time|tempo pieno|tempo parziale)$/;

function formatAmount(value: number) {
  // Punto come separatore delle migliaia (it-IT): «1.499».
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Retribuzione reale indicata, formattata («1.499 €/mese»); null se l'offerta non ne ha. */
export function announcedSalaryLabel(salary: string | null | undefined): string | null {
  const parsed = parseAnnouncedSalary(salary);
  if (!parsed) return null;
  const gross = /lord[oi]|\bral\b/i.test(salary ?? "");
  const unit = (gross ? " lordi" : "") + UNIT_LABEL[parsed.unitText];
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
 * Elementi di elenco (requisiti/mansioni) che aggiungono qualcosa alla descrizione.
 * Restituisce [] quando metà o più è già nella descrizione, o coincide con `exclude`.
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
 * Estratto troncato dalla fonte («...» / «…» in fondo): taglia all'ultima frase completa
 * (o all'ultima parola, chiudendo con «.»). `truncated` indica se c'era il taglio.
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
