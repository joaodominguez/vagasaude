/**
 * Título «limpo» para mostrar ao utilizador (cartões e H1). Funções puras, sem
 * dependências: não alteram slug, URL, <title> nem JSON-LD (o `job.title`
 * original continua a ser a fonte de verdade).
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
  "a", "o", "as", "os", "e", "ou", "de", "da", "do", "das", "dos", "em", "no",
  "na", "nos", "nas", "ao", "aos", "à", "às", "por", "para", "com", "sem", "um", "uma",
]);

/** «ENFERMEIRO/A DE URGÊNCIA» → «Enfermeiro/a de Urgência». */
export function fromAllCaps(text: string): string {
  let first = true;
  return text.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const isFirst = first;
    first = false;
    const lower = word.toLocaleLowerCase("pt-PT");
    if (/^\d/.test(word)) return word;
    // Siglas curtas (TSDT, UCI, EPE) mantêm-se, salvo palavras de ligação.
    if (word.length <= 3 && word.length > 1 && !SMALL_WORDS.has(lower)) return word;
    if (word.length <= 1) return isFirst ? lower.toLocaleUpperCase("pt-PT") : lower;
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("pt-PT") + lower.slice(1);
  });
}

/** Só letras maiúsculas (pelo menos 4): título TODO EM MAIÚSCULAS. */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return (
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase("pt-PT") &&
    letters !== letters.toLocaleLowerCase("pt-PT")
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hífens, dois-pontos, barras e espaços soltos nas pontas. */
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

type Place = {
  company?: string | null;
  city?: string | null;
  district?: string | null;
  contract?: string | null;
};

/**
 * Sufixo « — <entidade>» / « - <entidade>» / « | <contrato>»: repete o que já se mostra sob
 * o título. Só se remove quando partilha pelo menos uma palavra com a empresa (ou a cidade),
 * ou é exatamente o tipo de contrato da vaga. Com hífen simples exige-se que TODAS as palavras
 * do sufixo pertençam à empresa/cidade (evita cortar «Técnico Superior - Radiologia»).
 */
function stripEntitySuffix(title: string, place?: Place): string {
  const dash = title.match(/^(.*\S)\s+[—–]\s+([^—–]{2,90})$/);
  const hyphen = title.match(/^(.*\S)\s+-\s+([^—–-]{2,60})$/);
  const pipe = title.match(/^(.*\S)\s*\|\s*([^|]{2,60})$/);
  const known = new Set(
    [place?.company, place?.city, place?.district].flatMap((value) => tokens(value ?? "")),
  );
  if (dash) {
    const tail = tokens(dash[2]);
    if (tail.length > 0 && tail.some((word) => known.has(word))) return dash[1];
  }
  if (hyphen) {
    const tail = tokens(hyphen[2]);
    if (tail.length > 0 && tail.every((word) => known.has(word))) return hyphen[1];
  }
  if (pipe && place?.contract && foldText(pipe[2]).trim() === foldText(place.contract).trim()) {
    return pipe[1];
  }
  return title;
}

/** «(m/f)», «M/F», «(f/m)», «H/M» no fim ou a meio: o «/a» do título já cobre o género. */
const GENDER_RE = /\s*\(?\b(?:m\s*\/\s*f|f\s*\/\s*m|h\s*\/\s*m|m\s*\/\s*h)\b\.?\)?/gi;

/**
 * Título a mostrar:
 *  1. tira o sufixo « — <entidade>» quando a entidade já se mostra;
 *  2. tira «(m/f)» e « - <cidade>» final quando é a cidade (ou o distrito) da vaga;
 *  3. converte TÍTULOS EM MAIÚSCULAS para formato normal;
 *  4. aparta espaços e hífens soltos.
 * Se a limpeza esvaziar o título, devolve o original aparado.
 */
export function displayTitle(title: string, place?: Place): string {
  const original = trimEdges(title || "");
  let out = trimEdges(original.replace(GENDER_RE, ""));
  out = stripEntitySuffix(out, place);

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
  return out.charAt(0).toLocaleUpperCase("pt-PT") + out.slice(1);
}

/** Prefixo do tipo de procedimento: «Concurso …», «Bolsa de recrutamento …», «Procedimento concursal para …». */
const BANDO_PREFIX_RE =
  /^(?:procedimento\s+concursal(?:\s+(?:comum|urgente|simplificado))?|concurso(?:\s+de\s+(?:ingresso|acesso|m[eé]ritos))?|bolsa\s+de\s+(?:recrutamento|reservas?|candidatos)|reserva\s+de\s+recrutamento|mobilidade\s+(?:interna|intercarreiras)|manifesta[cç][aã]o\s+de\s+interesse|aviso(?:\s+de\s+abertura)?|recrutamento)\s*(?:[:\-–—]\s*|(?:de|para)\s+)?(?:(?:(\d+)\s+(?:postos?\s+de\s+trabalho|vagas?|lugares?))\s+(?:de|para)\s+)?/i;

/**
 * Para os cartões: tira o prefixo do tipo de procedimento (já está na etiqueta «Concurso»)
 * e devolve o número de vagas se se indicar. O título completo fica no H1.
 */
export function compactBandoTitle(title: string): { title: string; posts: number | null } {
  const match = title.match(BANDO_PREFIX_RE);
  if (!match || match[0].length === 0 || match[0].length >= title.length) {
    return { title, posts: null };
  }
  const rest = title.slice(match[0].length).trim();
  if (rest.length < 4) return { title, posts: null };
  return {
    title: rest.charAt(0).toLocaleUpperCase("pt-PT") + rest.slice(1),
    posts: match[1] ? Number(match[1]) : null,
  };
}

/** O título já cita o lugar? */
export function titleMentionsPlace(title: string, place: string): boolean {
  if (!place) return true;
  return foldText(title).includes(foldText(place).trim());
}
