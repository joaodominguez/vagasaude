import { BRAZIL_STATES } from "@/lib/brazil-states";

/**
 * Título «limpo» para mostrar ao usuário (cartões e H1 das vagas). Funções puras, sem
 * dependências: não alteram slug, URL, <title> nem JSON-LD (o `job.title` original
 * continua a ser a fonte de verdade).
 */

/** Remove acentos e passa a minúsculas, para comparações tolerantes. */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Palavras de ligação que ficam em minúsculas quando o título vem em maiúsculas. */
const SMALL_WORDS = new Set([
  "a", "e", "o", "as", "os", "ou", "de", "da", "do", "das", "dos", "em", "na", "no",
  "nas", "nos", "para", "pra", "com", "por", "pela", "pelo", "ao", "aos", "à", "às",
  "um", "uma", "d",
]);

/** «TÉCNICO DE ENFERMAGEM UTI» → «Técnico de Enfermagem UTI». */
export function fromAllCaps(text: string): string {
  let first = true;
  return text.replace(/(['’])?[\p{L}\p{N}]+/gu, (token, apostrophe?: string) => {
    const isFirst = first;
    first = false;
    const word = apostrophe ? token.slice(1) : token;
    const lower = word.toLocaleLowerCase("pt-BR");
    if (/^\d/.test(word)) return token;
    if (apostrophe) return apostrophe + lower;
    // Siglas curtas (UTI, CTI, PCD) ficam em maiúsculas, salvo as palavras de ligação.
    if (word.length <= 3 && word.length > 1 && !SMALL_WORDS.has(lower)) return word;
    if (word.length <= 1) return isFirst ? lower.toLocaleUpperCase("pt-BR") : lower;
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
  });
}

/** Só letras maiúsculas (pelo menos 4 letras): título TODO EM MAIÚSCULAS. */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return (
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase("pt-BR") &&
    letters !== letters.toLocaleLowerCase("pt-BR")
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hífens/dois-pontos/barras/espaços soltos nas pontas. */
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

type Place = { company?: string | null; city?: string | null; district?: string | null };

const UF_CODES = new Set<string>(BRAZIL_STATES.map((s) => s.uf));
const UF_RE = /^[A-Z]{2}$/;

/**
 * Editais: «Enfermeiro e outras especialidades — Prefeitura de Nova Trento (SC)». O sufixo
 * « — <entidade>» repete a entidade já mostrada abaixo do título: só se remove quando
 * partilha pelo menos uma palavra com a entidade (ou a cidade) da vaga.
 */
function stripEntitySuffix(title: string, place?: Place): string {
  const match = title.match(/^(.*\S)\s+[—–]\s+([^—–]{2,90})$/);
  if (!match) return title;
  const tail = tokens(match[2]);
  if (tail.length === 0) return title;
  const known = new Set(
    [place?.company, place?.city, place?.district].flatMap((value) => tokens(value ?? "")),
  );
  return tail.some((word) => known.has(word)) ? match[1] : title;
}

/** «Belém - PA», «São Paulo (SP)», «Garopaba/SC», «SP» → true se for só local da vaga. */
function isPlaceSegment(segment: string, place?: Place): boolean {
  const seg = trimEdges(segment.replace(/[()]/g, " "));
  if (!seg) return false;
  // Só a sigla do estado («SP», «PA»).
  if (UF_RE.test(seg) && UF_CODES.has(seg)) return true;
  // «Cidade - UF», «Cidade/UF».
  const withUf = seg.match(/^(.+?)\s*[-–/]\s*([A-Z]{2})$/);
  const name = withUf && UF_CODES.has(withUf[2]) ? withUf[1] : seg;
  const folded = foldText(name).trim();
  const known = [place?.city, place?.district].filter(Boolean) as string[];
  return known.some((value) => foldText(value).trim() === folded);
}

/**
 * Título a mostrar:
 *  1. remove o sufixo « — <entidade>» dos editais quando a entidade já aparece;
 *  2. remove cidade/estado no fim («… | Belém - PA», «… - Itaguaí», «… (SP)»);
 *  3. converte TÍTULOS EM MAIÚSCULAS para o formato normal;
 *  4. tira espaços e hífens soltos.
 * Se a limpeza esvaziar o título, devolve o original aparado.
 */
export function displayTitle(title: string, place?: Place): string {
  const original = trimEdges(title || "");
  let out = stripEntitySuffix(original, place);

  // «… (SP)» no fim.
  out = trimEdges(out.replace(/\s*\(\s*([A-Z]{2})\s*\)\s*$/, (m, uf: string) => (UF_CODES.has(uf) ? "" : m)));

  // Segmentos finais separados por | – — - que são só o local da vaga (até 2 vezes).
  for (let i = 0; i < 2; i++) {
    const m = out.match(/^(.*\S)\s*(?:\||\s[-–—]\s)\s*([^|–—]+?)\s*$/) ?? out.match(/^(.*\S)\s*\|\s*([^|]+)$/);
    if (!m || !isPlaceSegment(m[2], place)) break;
    out = trimEdges(m[1]);
  }
  // «Cidade - Cidade» já tratado; «… - Itaguaí» com hífen colado ao nome.
  for (const name of [place?.city, place?.district]) {
    if (!name) continue;
    const suffix = new RegExp(String.raw`\s*[\-–—|,]\s*${escapeRegExp(name)}\s*$`, "i");
    if (suffix.test(out)) out = trimEdges(out.replace(suffix, ""));
  }

  out = trimEdges(out);
  if (isAllCaps(out)) out = fromAllCaps(out);
  if (!out) return original;
  return out.charAt(0).toLocaleUpperCase("pt-BR") + out.slice(1);
}

/**
 * «Concurso público para 15 vagas de Enfermeiro» → { title, posts }.
 * Nos cartões tira o prefixo do tipo de edital (já indicado na etiqueta) e devolve o
 * número de vagas, se houver. O título completo continua no H1 da página.
 */
const EDITAL_PREFIX_RE =
  /^(?:(?:concurso\s+p[uú]blico|processo\s+seletivo(?:\s+(?:simplificado|p[uú]blico))?|sele[cç][aã]o\s+(?:p[uú]blica|simplificada)|edital(?:\s+n[ºo.°]*\s*[\d./-]+)?|chamamento\s+p[uú]blico)\s*(?:[-–—:]\s*)?(?:para|de)?\s*)(?:(\d+)\s+vagas?\s+(?:para|de|em)\s+)?/i;

export function compactBandoTitle(title: string): { title: string; posts: number | null } {
  const match = title.match(EDITAL_PREFIX_RE);
  if (!match || match[0].length === 0 || match[0].length >= title.length) {
    return { title, posts: null };
  }
  const rest = title.slice(match[0].length).trim();
  if (rest.length < 4) return { title, posts: null };
  return {
    title: rest.charAt(0).toLocaleUpperCase("pt-BR") + rest.slice(1),
    posts: match[1] ? Number(match[1]) : null,
  };
}

/** O título já cita o local? */
export function titleMentionsPlace(title: string, place: string): boolean {
  if (!place) return true;
  return foldText(title).includes(foldText(place).trim());
}
