/**
 * Pulizia dei titoli delle offerte.
 *
 * TODO(IT): gli avvisi pubblici italiani (bandi di concorso, Gazzetta Ufficiale, albi pretori di
 * ASL/AO) hanno titoli burocratici lunghi ("Concorso pubblico, per titoli ed esami, per la
 * copertura a tempo indeterminato di n. X posti di Dirigente Medico … disciplina di …"). Servono
 * schemi propri con test, e hanno senso solo quando esisteranno scraper di bandi. Per ora si
 * normalizzano solo spazi, puntini di sospensione e code spezzate.
 */

const WHITESPACE_RE = /\s+/g;
const ELLIPSIS_RE = /(?:…|\.{2,})\s*$/;

/** Connettivi che non possono chiudere un titolo troncato ("Infermiere di", "… e"). */
const TRAILING_CONNECTOR_RE =
  /\s+(?:di|del|dello|della|dei|degli|delle|dal|dalla|nel|nella|nei|negli|nelle|il|lo|la|i|gli|le|un|una|in|per|con|su|a|ad|e|ed|o|od)$/i;

/** Pulisce la fine dei titoli troncati: "Infermiere in", "( )", virgole finali. */
export function tidyTitleEnd(text: string): string {
  let out = text.replace(/\(\s*\)/g, "").replace(/\s+,/g, ",");
  const ellipsis = /…$/.test(out);
  out = out.replace(/…$/, "");
  let prev: string;
  do {
    prev = out;
    out = out
      .replace(/[\s,;:—\-–―/]+$/g, "")
      .replace(TRAILING_CONNECTOR_RE, "");
  } while (out !== prev);
  out = out.replace(/\s{2,}/g, " ").trim();
  if (out.length < 3) return text;
  return ellipsis ? `${out}…` : out;
}

export function shortenJobTitle(title: string, maxLen = 96): string {
  let out = (title || "").trim().replace(WHITESPACE_RE, " ").replace(ELLIPSIS_RE, "");
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1).replace(/[ ,;—\-]+$/g, "") + "…";
  }
  return tidyTitleEnd(out);
}
