/**
 * Formata texto de vagas: transforma listas coladas numa linha
 * (ex.: "- A...- B...;- C") em blocos legíveis (parágrafos / bullets).
 */

export type JobTextBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const HEADING_RE =
  /^(condi[cç][oõ]es\s+oferecidas|requisitos|perfil|responsabilidades|o\s+que\s+oferecemos|fun[cç][aã]o|descri[cç][aã]o)\s*:?\s*$/i;

export function formatJobDescriptionText(raw: string): JobTextBlock[] {
  const normalized = normalizeInlineLists(raw);
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const blocks: JobTextBlock[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const line of lines) {
    const bullet = matchBullet(line);
    if (bullet) {
      listItems.push(bullet);
      continue;
    }
    flushList();
    const heading = line.replace(/:$/, "").trim();
    if (HEADING_RE.test(heading) || HEADING_RE.test(line)) {
      blocks.push({ type: "heading", text: heading.replace(/:$/, "") });
      continue;
    }
    blocks.push({ type: "paragraph", text: line });
  }
  flushList();
  return blocks;
}

function matchBullet(line: string): string | null {
  const m = line.match(/^[-•*]\s+(.+)$/);
  if (m) return m[1].trim();
  const numbered = line.match(/^\d+[.)]\s+(.+)$/);
  if (numbered) return numbered[1].trim();
  return null;
}

/** Quebra bullets colados no mesmo parágrafo. */
export function normalizeInlineLists(text: string): string {
  let out = text.replace(/\r/g, "");
  // ";- Item" / "; - Item"
  out = out.replace(/;\s*-\s+/g, "\n- ");
  // Fim de frase/palavra + bullet sem newline: "enfermeiro- Ajudar" / "higiene.- Preparar"
  out = out.replace(
    /([a-zàáâãäåæçèéêëìíîïñòóôõöùúûüýÿ0-9)\]])\s*-\s+(?=[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ])/gu,
    "$1\n- ",
  );
  // "texto: - Item" no meio do parágrafo
  out = out.replace(/:\s+-\s+/g, ":\n- ");
  // Espaço antes de bullet já no início relativo
  out = out.replace(/\s+-\s+(?=[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ])/gu, "\n- ");
  return out;
}
