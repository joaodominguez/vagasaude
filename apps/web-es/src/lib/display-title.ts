/**
 * Título «limpio» para mostrar al usuario (tarjetas y H1). Funciones puras, sin
 * dependencias: no alteran slug, URL, <title> ni JSON-LD (el `job.title`
 * original sigue siendo la fuente de verdad).
 */

/** Quita los acentos y pasa a minúsculas, para comparaciones tolerantes. */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Conectores que quedan en minúscula cuando el título viene en mayúsculas. */
const SMALL_WORDS = new Set([
  "a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "lo", "los", "o", "para",
  "por", "u", "un", "una", "y", "sin", "sobre", "ante",
]);

/** «ENFERMERO/A DE URGENCIAS» → «Enfermero/a de Urgencias». */
export function fromAllCaps(text: string): string {
  let first = true;
  return text.replace(/(['’])?[\p{L}\p{N}]+/gu, (token, apostrophe?: string) => {
    const isFirst = first;
    first = false;
    const word = apostrophe ? token.slice(1) : token;
    const lower = word.toLocaleLowerCase("es-ES");
    if (/^\d/.test(word)) return token;
    if (apostrophe) return apostrophe + lower;
    // Siglas cortas (TCAE, SAS, UCI) siguen en mayúsculas, salvo los conectores.
    if (word.length <= 3 && word.length > 1 && !SMALL_WORDS.has(lower)) return word;
    if (word.length <= 1) return isFirst ? lower.toLocaleUpperCase("es-ES") : lower;
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("es-ES") + lower.slice(1);
  });
}

/** Solo letras mayúsculas (al menos 4): título TODO EN MAYÚSCULAS. */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return (
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase("es-ES") &&
    letters !== letters.toLocaleLowerCase("es-ES")
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Guiones, dos puntos, barras y espacios sueltos en los extremos. */
function trimEdges(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|,;·]+/, "")
    .replace(/[\s\-–—:|,;·]+$/, "")
    .trim();
}

function tokens(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 || /^\d+$/.test(word));
}

/**
 * Títulos de convocatorias: «Concurso Jefe/a de Bloque — SAS (Hospital X)». El sufijo
 * « — <ente>» repite la entidad ya mostrada bajo el título: solo se quita si comparte
 * al menos una palabra con la empresa (o la ciudad) de la oferta.
 */
function stripEntitySuffix(
  title: string,
  place?: { company?: string | null; city?: string | null; district?: string | null },
): string {
  const match = title.match(/^(.*\S)\s+[—–]\s+([^—–]{2,90})$/);
  if (!match) return title;
  const tail = tokens(match[2]);
  if (tail.length === 0) return title;
  const known = new Set(
    [place?.company, place?.city, place?.district].flatMap((value) => tokens(value ?? "")),
  );
  return tail.some((word) => known.has(word)) ? match[1] : title;
}

/**
 * Título a mostrar:
 *  1. quita el sufijo « — <ente>» de las convocatorias cuando la entidad ya se muestra;
 *  2. quita « - <ciudad>» final cuando es la ciudad (o la comunidad) de la oferta;
 *  3. convierte los TÍTULOS EN MAYÚSCULAS a formato normal;
 *  4. quita espacios y guiones sueltos.
 * Si la limpieza vaciara el título, devuelve el original limpio.
 */
export function displayTitle(
  title: string,
  place?: { company?: string | null; city?: string | null; district?: string | null },
): string {
  const original = trimEdges(title || "");
  let out = stripEntitySuffix(original, place);

  for (const name of [place?.city, place?.district]) {
    if (!name) continue;
    const suffix = new RegExp(String.raw`\s*[\-–—|,]\s*${escapeRegExp(name)}\s*$`, "i");
    if (suffix.test(out)) {
      out = trimEdges(out.replace(suffix, ""));
    } else {
      const m = out.match(/\s*[\-–—|,]\s*([^\-–—|,]+)$/);
      if (m && foldText(m[1]).trim() === foldText(name).trim()) {
        out = trimEdges(out.slice(0, out.length - m[0].length));
      }
    }
  }

  out = trimEdges(out);
  if (isAllCaps(out)) out = fromAllCaps(out);
  if (!out) return original;
  return out.charAt(0).toLocaleUpperCase("es-ES") + out.slice(1);
}

/**
 * «Oposición Personal Técnico…», «Concurso Jefe/a de Bloque…», «Bolsa de empleo Enfermería…»,
 * «Concurso de traslados…», «OPE 2026 …»: prefijo del tipo de convocatoria.
 */
const BANDO_PREFIX_RE =
  /^(?:oposici[oó]n(?:es)?|concurso[- ]oposici[oó]n|concurso(?: de (?:traslados?|m[eé]ritos|movilidad))?|bolsa(?: de (?:empleo|trabajo|contrataci[oó]n)(?: temporal)?)?|ope(?: \d{4})?|convocatoria|proceso selectivo|contrataci[oó]n temporal|oferta de empleo p[uú]blico)\s*(?:[:\-–—]\s*|(?:de|para)\s+)?(?:(?:(\d+)\s+plazas?)\s+(?:de|para)\s+)?/i;

/**
 * Para las tarjetas: quita el prefijo del tipo de convocatoria (ya está en la etiqueta
 * «Oposición») y devuelve el número de plazas si se indica. El título completo queda en el H1.
 */
export function compactBandoTitle(title: string): { title: string; posts: number | null } {
  const match = title.match(BANDO_PREFIX_RE);
  if (!match || match[0].length === 0 || match[0].length >= title.length) {
    return { title, posts: null };
  }
  const rest = title.slice(match[0].length).trim();
  if (rest.length < 4) return { title, posts: null };
  return {
    title: rest.charAt(0).toLocaleUpperCase("es-ES") + rest.slice(1),
    posts: match[1] ? Number(match[1]) : null,
  };
}

/** ¿El título ya cita el lugar? */
export function titleMentionsPlace(title: string, place: string): boolean {
  if (!place) return true;
  return foldText(title).includes(foldText(place).trim());
}
