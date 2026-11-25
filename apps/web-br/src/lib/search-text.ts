/**
 * Pesquisa tolerante: ignora maiúsculas, acentos, género e plural. O texto das vagas e a pesquisa
 * passam pelo mesmo caminho — minúsculas, sem diacríticos, só letras/números — e cada palavra é
 * reduzida ao radical (stemmer leve, conservador, com mínimo de 4 letras). Uma vaga serve se TODAS as
 * palavras relevantes da pesquisa (sem palavras vazias como "de", "da", "e") aparecerem, por qualquer
 * ordem. Igual nos 4 sites (pt, es, it); cada app usa o seu idioma.
 */
export type SearchLang = "pt" | "es" | "it";

const STOPWORDS: Record<SearchLang, Set<string>> = {
  pt: new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o", "as", "os", "no", "na", "nos", "nas"]),
  es: new Set(["de", "del", "la", "el", "los", "las", "y", "en", "para", "a", "un", "una"]),
  it: new Set(["di", "del", "della", "dei", "delle", "e", "in", "per", "il", "la", "lo", "i", "gli", "le", "a", "da", "dello", "degli", "al", "alla"]),
};

const MIN_STEM = 4;

/** Minúsculas, sem acentos, e tudo o que não é letra/número vira espaço. */
export function foldText(text: string, lang: SearchLang): string {
  return text
    .toLocaleLowerCase(lang)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripVowels(word: string): string {
  let w = word;
  while (w.length > MIN_STEM && /[aeiou]$/.test(w)) w = w.slice(0, -1);
  return w;
}

function replaceEnding(word: string, ending: string, repl: string): string | null {
  if (word.length - ending.length + repl.length < MIN_STEM) return null;
  return word.endsWith(ending) ? word.slice(0, -ending.length) + repl : null;
}

/**
 * Forma "leve" (só plural, sem género) para a descrição: ali "médica" aparece em "assistência médica"
 * e não deve trazer todas as vagas quando se pesquisa "médico". No título/entidade/profissão usa-se o radical.
 */
export function lightWord(word: string, lang: SearchLang): string {
  if (word.length <= MIN_STEM || lang === "it" || /^\d+$/.test(word)) return word;
  const plural =
    (lang === "pt" &&
      (replaceEnding(word, "oes", "ao") ?? replaceEnding(word, "aes", "ao") ?? replaceEnding(word, "ais", "al") ?? replaceEnding(word, "eis", "el"))) ||
    (lang === "es" && replaceEnding(word, "ones", "on")) ||
    replaceEnding(word, "ores", "or") ||
    (lang === "es" && /[^aeiou]es$/.test(word) ? replaceEnding(word, "es", "") : null);
  return plural || (word.endsWith("s") && word.length - 1 >= MIN_STEM ? word.slice(0, -1) : word);
}

/** Texto da descrição na forma leve, com espaços nas pontas. */
export function lightText(text: string, lang: SearchLang): string {
  const folded = foldText(text, lang);
  if (!folded) return " ";
  return ` ${folded.split(" ").map((w) => lightWord(w, lang)).join(" ")} `;
}

/** Radical de uma palavra já "dobrada" (sem acentos, minúscula). */
export function stemWord(word: string, lang: SearchLang): string {
  if (word.length <= MIN_STEM || /^\d+$/.test(word)) return word;
  let w = word;
  if (lang === "it") {
    w = replaceEnding(w, "oressa", "or") ?? replaceEnding(w, "trice", "tor") ?? replaceEnding(w, "trici", "tor") ?? w;
    return stripVowels(w);
  }
  // PT / ES
  const plural =
    (lang === "pt" &&
      (replaceEnding(w, "oes", "ao") ?? replaceEnding(w, "aes", "ao") ?? replaceEnding(w, "ais", "al") ?? replaceEnding(w, "eis", "el"))) ||
    (lang === "es" && replaceEnding(w, "ones", "on")) ||
    replaceEnding(w, "ores", "or") ||
    (lang === "es" && /[^aeiou]es$/.test(w) ? replaceEnding(w, "es", "") : null);
  w = plural || (w.endsWith("s") && w.length - 1 >= MIN_STEM ? w.slice(0, -1) : w);
  w = replaceEnding(w, "ora", "or") ?? w;
  return stripVowels(w);
}

/** Texto das vagas reduzido a radicais, com espaços nas pontas: " medic enfermeir saud ". */
export function stemmedText(text: string, lang: SearchLang): string {
  const folded = foldText(text, lang);
  if (!folded) return " ";
  return ` ${folded.split(" ").map((w) => stemWord(w, lang)).join(" ")} `;
}

export type ParsedQuery = {
  /** Radicais que têm de aparecer todos. */
  stems: string[];
  /** Forma leve (só plural) de cada palavra, para a descrição. */
  lights: string[];
  /** Palavra inteira (dobrada) de cada radical — para a pesquisa por prefixo ao escrever. */
  words: string[];
  folded: string;
};

export function parseQuery(raw: string, lang: SearchLang): ParsedQuery {
  const folded = foldText(raw, lang);
  const all = folded ? folded.split(" ") : [];
  const meaningful = all.filter((w) => !STOPWORDS[lang].has(w));
  const words = meaningful.length ? meaningful : all;
  return { stems: words.map((w) => stemWord(w, lang)), lights: words.map((w) => lightWord(w, lang)), words, folded };
}

/** Todas as palavras da pesquisa aparecem (como radical, ou na forma leve) no texto já reduzido? */
export function stemmedHasAll(stemmed: string, q: ParsedQuery): boolean {
  for (let i = 0; i < q.stems.length; i++) {
    const stem = q.stems[i];
    if (stemmed.includes(` ${stem} `) || stemmed.includes(` ${q.lights[i]} `)) continue;
    // Palavra sem terminação reconhecida (ex. "enferm", "enfermag"): aceita como prefixo.
    if (q.words[i] === stem && stem.length >= 6 && stemmed.includes(` ${stem}`)) continue;
    return false;
  }
  return true;
}
