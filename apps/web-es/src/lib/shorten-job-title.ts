/**
 * Limpieza de títulos de oferta.
 *
 * TODO(ES): la versión portuguesa (apps/web/src/lib/shorten-job-title.ts)
 * recortaba títulos burocráticos de avisos públicos (DRE/BEP/ULS: "procedimento
 * concursal … categoria de …"). El equivalente español (BOE / boletines
 * autonómicos / OPE: "Resolución … por la que se convoca proceso selectivo …
 * categoría de Enfermero/a … turno libre") necesita su propio conjunto de
 * patrones y tests, y solo tiene sentido cuando existan scrapers de boletines.
 * Mientras tanto solo se normaliza espacios, elipsis y finales colgantes.
 */

const WHITESPACE_RE = /\s+/g;
const ELLIPSIS_RE = /(?:…|\.{2,})\s*$/;

/** Conectores que no pueden cerrar un título cortado ("Enfermero de", "… y"). */
const TRAILING_CONNECTOR_RE =
  /\s+(?:de|del|la|el|los|las|en|para|con|por|al|a|y|e|o|u)$/i;

/** Limpia el final de títulos cortados: "Enfermero en", "( )", comas colgantes. */
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
