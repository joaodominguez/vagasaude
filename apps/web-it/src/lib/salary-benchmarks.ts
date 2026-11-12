/**
 * Riferimenti indicativi di retribuzione lorda per professione sanitaria
 * (Italia). DATASET VUOTO: nessuna cifra inventata.
 *
 * Per aggiungere un riferimento servono una fonte primaria pubblica (es.
 * tabelle retributive del CCNL Comparto Sanità o della Dirigenza medica) e la
 * relativa citazione in un commento accanto alla regola, con anno e URL.
 * Convenzione degli importi: euro lordi / mese = retribuzione lorda ANNUA ÷ 12.
 * Finché `TITLE_RULES` e `BY_PROFESSION` sono vuoti `getSalaryBenchmark`
 * restituisce sempre null e nell'interfaccia compare solo la retribuzione
 * indicata nell'annuncio, se presente.
 */

export type SalaryBenchmark = {
  /** Etichetta della funzione usata nella stima. */
  label: string;
  /** Punto medio tra `low` e `high` (euro lordi / mese, annuo ÷ 12). */
  average: number;
  low: number;
  high: number;
  /** "range" = intervallo tra tabelle pubbliche; "floor" = minimo contrattuale (low = average = high). */
  kind: "range" | "floor";
  /** Fonte citata (testo mostrato all'utente). */
  source: string;
};

type Figures = {
  label: string;
  average?: number;
  low: number;
  high: number;
  kind: "range" | "floor";
  basis: "pubblico" | "contratto";
  source: string;
};

type TitleRule = {
  test: RegExp;
  professions?: string[];
  figures: Figures | null;
};

const TITLE_RULES: TitleRule[] = [];
const BY_PROFESSION: Record<string, Figures> = {};

function norm(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const PRIVATE_NOTE =
  " Nel settore privato o accreditato la retribuzione reale può differire dalle tabelle pubbliche.";
const DISCLAIMER = " Non è la retribuzione di questa offerta.";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatEuroRange(low: number, high: number) {
  return `${formatEuro(low)} – ${formatEuro(high)}`;
}

function build(f: Figures, sector?: string | null): SalaryBenchmark {
  const key = norm(sector || "");
  const isPrivateLike = key.includes("privato") || key.includes("accreditato");
  return {
    label: f.label,
    average: f.average ?? Math.round((f.low + f.high) / 2),
    low: f.low,
    high: f.high,
    kind: f.kind,
    source:
      f.source +
      (f.basis === "pubblico" && isPrivateLike ? PRIVATE_NOTE : "") +
      DISCLAIMER,
  };
}

/** null quando non c'è un riferimento verificato per quella funzione (vedi intestazione del file). */
export function getSalaryBenchmark(
  profession: string,
  title?: string | null,
  sector?: string | null,
): SalaryBenchmark | null {
  const blob = norm(`${title || ""} ${profession || ""}`);

  for (const rule of TITLE_RULES) {
    if (rule.professions && !rule.professions.includes(profession)) continue;
    if (!rule.test.test(blob)) continue;
    return rule.figures ? build(rule.figures, sector) : null;
  }

  const fallback = BY_PROFESSION[profession];
  if (!fallback) return null;
  return build(fallback, sector);
}
