/**
 * Titolo «pulito» da mostrare all'utente (H1, schede). Funzioni pure, senza
 * dipendenze: non alterano slug, URL, <title> né JSON-LD (il `job.title`
 * originale resta la fonte di verità).
 */

/** Rimuove gli accenti e porta in minuscolo, per confronti tolleranti. */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Parole di collegamento che restano minuscole quando il titolo è in maiuscolo. */
const SMALL_WORDS = new Set([
  "a", "e", "ed", "o", "di", "da", "del", "dello", "della", "dei", "degli", "delle",
  "dell", "in", "nel", "nello", "nella", "nei", "negli", "nelle", "per", "con", "su",
  "sul", "sulla", "al", "allo", "alla", "ai", "agli", "alle", "all", "il", "lo", "la",
  "i", "gli", "le", "un", "una", "uno", "d", "l",
]);

/** «INFERMIERE PROFESSIONALE PS» → «Infermiere Professionale PS». */
export function fromAllCaps(text: string): string {
  let first = true;
  return text.replace(/(['’])?[\p{L}\p{N}]+/gu, (token, apostrophe?: string) => {
    const isFirst = first;
    first = false;
    const word = apostrophe ? token.slice(1) : token;
    const lower = word.toLocaleLowerCase("it-IT");
    if (/^\d/.test(word)) return token;
    if (apostrophe) return apostrophe + lower;
    // Sigle brevi (OSS, ASL, TSRM) restano maiuscole, salvo i collegamenti.
    if (word.length <= 3 && word.length > 1 && !SMALL_WORDS.has(lower)) return word;
    if (word.length <= 1) return isFirst ? lower.toLocaleUpperCase("it-IT") : lower;
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("it-IT") + lower.slice(1);
  });
}

/** Solo lettere maiuscole (almeno 4 lettere): titolo TUTTO IN MAIUSCOLO. */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return (
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase("it-IT") &&
    letters !== letters.toLocaleLowerCase("it-IT")
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Trattini/due punti/barre/spazi sciolti agli estremi. */
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
 * Titoli dei bandi: «Concorso pubblico per 3 posti di X — ASL Roma 5». Il suffisso
 * « — <ente>» ripete l'ente già mostrato sotto il titolo: si toglie solo se condivide
 * almeno una parola con l'ente (o con il comune) dell'offerta.
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
 * Titolo da mostrare:
 *  1. rimuove il suffisso « — <ente>» dei bandi quando l'ente è già mostrato;
 *  2. rimuove « - <comune>» finale quando è il comune (o la regione) dell'offerta;
 *  3. converte i TITOLI IN MAIUSCOLO in formato normale;
 *  4. toglie spazi e trattini sciolti.
 * Se la pulizia svuota il titolo, restituisce l'originale ripulito.
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
  return out.charAt(0).toLocaleUpperCase("it-IT") + out.slice(1);
}

/** «Concorso pubblico per 15 posti di Dirigente Medico – Neurologia» → { role, posts }. */
const BANDO_PREFIX_RE =
  /^(?:concorso pubblico|selezione pubblica|avviso(?: pubblico)?(?: a tempo determinato| di mobilit[àa])?|mobilit[àa](?: volontaria)?|graduatoria)\s+(?:(?:per|di)\s+)?(?:(?:titoli ed esami|soli titoli)\s+)?(?:per\s+)?(?:(\d+)\s+post[oi]\s+(?:di|da)\s+)?/i;

/**
 * Per le schede: toglie il prefisso del tipo di bando (già nel chip «Concorso pubblico»)
 * e restituisce il numero di posti, se indicato. Il titolo completo resta nell'H1.
 */
export function compactBandoTitle(title: string): { title: string; posts: number | null } {
  const match = title.match(BANDO_PREFIX_RE);
  if (!match || match[0].length === 0 || match[0].length >= title.length) {
    return { title, posts: null };
  }
  const rest = title.slice(match[0].length).trim();
  if (rest.length < 4) return { title, posts: null };
  return {
    title: rest.charAt(0).toLocaleUpperCase("it-IT") + rest.slice(1),
    posts: match[1] ? Number(match[1]) : null,
  };
}

/** Il titolo cita già il luogo? */
export function titleMentionsPlace(title: string, place: string): boolean {
  if (!place) return true;
  return foldText(title).includes(foldText(place).trim());
}
