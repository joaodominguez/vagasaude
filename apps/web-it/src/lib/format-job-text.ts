/**
 * Formatta il testo delle offerte: trasforma gli elenchi incollati su una riga
 * (es. "- A...- B...;- C") in blocchi leggibili (paragrafi / elenchi puntati).
 */

export type JobTextBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const HEADING_RE =
  /^(requisiti(?:\s+(?:richiesti|di\s+ammissione|minimi))?|mansioni|attivit[aà]|responsabilit[aà]|compiti|profilo(?:\s+ricercato)?|cosa\s+offriamo|offriamo|si\s+offre|condizioni\s+offerte|sede\s+di\s+lavoro|descrizione(?:\s+della\s+posizione|\s+del\s+ruolo)?|titoli\s+(?:di\s+studio|richiesti)|come\s+candidarsi|scadenza)\s*:?\s*$/i;

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

/** Separa gli elenchi puntati incollati nello stesso paragrafo. */
export function normalizeInlineLists(text: string): string {
  let out = text.replace(/\r/g, "");
  // ";- Item" / "; - Item"
  out = out.replace(/;\s*-\s+/g, "\n- ");
  // Fine frase/parola + punto elenco senza a capo: "infermiere- Assistere" / "igiene.- Preparare"
  out = out.replace(
    /([a-zàáâãäåæçèéêëìíîïñòóôõöùúûüýÿ0-9)\]])\s*-\s+(?=[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ])/gu,
    "$1\n- ",
  );
  // "testo: - Voce" in mezzo al paragrafo
  out = out.replace(/:\s+-\s+/g, ":\n- ");
  // Spazio prima di un punto elenco già a inizio riga relativo
  out = out.replace(/\s+-\s+(?=[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ])/gu, "\n- ");
  return out;
}
