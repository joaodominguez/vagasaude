/**
 * Separa dalla descrizione la sezione «Cosa offriamo» (benefit) per mostrarla a parte,
 * come nella maqueta. Funzione pura: se non trova un'intestazione chiara seguita da
 * un elenco, la descrizione resta com'è.
 */
import { formatJobDescriptionText, type JobTextBlock } from "@/lib/format-job-text";
import { foldText } from "@/lib/display-title";

const OFFER_HEADING_RE =
  /^(?:cosa\s+(?:ti\s+)?offriamo|(?:questo\s+[eè]\s+quello\s+che\s+)?ti\s+offriamo|offriamo|si\s+offre|noi\s+offriamo|cosa\s+troverai|perch[eé]\s+(?:unirsi\s+a\s+noi|scegliere\s+noi|dovresti\s+scegliere\s+noi)|i\s+vantaggi\s+di\s+collaborare\s+con\s+noi|benefit|vantaggi)\b/;

/** Intestazioni «grezze» (non riconosciute da format-job-text) che aprono la sezione. */
function isOfferHeading(text: string): boolean {
  const folded = foldText(text).replace(/[:?]+$/, "").trim();
  return folded.length <= 60 && OFFER_HEADING_RE.test(folded);
}

/**
 * Righe di boilerplate legale delle agenzie per il lavoro, rimosse solo quando la riga
 * è esattamente questo («Aut. Min. 16/12/2004», «Protocollo 1210-SG», «Adecco Italia S.p.A.
 * Aut. Prot. N. …», frase sugli «ambo i sessi», rimando all'informativa privacy).
 */
const BOILERPLATE_RES: RegExp[] = [
  /^aut\.?\s*(?:min(?:isteriale)?\.?|prot(?:ocollo)?\.?)\s*(?:n\.?\s*)?[\w\/.\-– ]{0,40}$/i,
  /^prot(?:ocollo|\.)\s*(?:n\.?\s*)?[\w\/.\-– ]{0,25}$/i,
  /^[\p{L} .&']{3,50}\s*[-–—,]?\s*aut\.?\s*(?:min\.?|prot\.?)[^\n]{0,60}$/iu,
  /^(?:la presente (?:ricerca|selezione|offerta)|l['’]annuncio|l['’]offerta) [^\n]{0,80}ambo i sessi[^\n]{0,80}$/i,
  /^(?:i candidati|le candidature)[^\n]{0,60}(?:ambosessi|ambo i sessi)[^\n]{0,80}$/i,
  /^(?:il|la) candidat[oa] [^\n]{0,40}informativa (?:sulla )?privacy[^\n]{0,120}$/i,
];

function isBoilerplate(text: string): boolean {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= 160 && BOILERPLATE_RES.some((re) => re.test(line));
}

function blockKey(block: JobTextBlock): string {
  const text = block.type === "list" ? block.items.join("|") : block.text;
  return `${block.type === "list" ? "l" : "t"}:${foldText(text).replace(/[^a-z0-9|]+/g, " ").trim()}`;
}

/**
 * Pulisce i blocchi: toglie il boilerplate delle agenzie e i blocchi ripetuti
 * (alcune fonti duplicano il testo); resta la prima occorrenza.
 */
export function cleanBlocks(blocks: JobTextBlock[]): JobTextBlock[] {
  const seen = new Set<string>();
  const out: JobTextBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "list" && isBoilerplate(block.text)) continue;
    const key = blockKey(block);
    if (key.length > 4 && seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }
  return out;
}

export function splitOffering(raw: string): { blocks: JobTextBlock[]; offering: string[] } {
  const blocks = cleanBlocks(formatJobDescriptionText(raw));
  for (let i = 0; i < blocks.length - 1; i++) {
    const block = blocks[i];
    const text = block.type === "heading" || block.type === "paragraph" ? block.text : null;
    const next = blocks[i + 1];
    if (text && isOfferHeading(text) && next.type === "list" && next.items.length >= 2) {
      const rest = blocks.filter((_, index) => index !== i && index !== i + 1);
      return { blocks: rest, offering: next.items };
    }
  }
  return { blocks, offering: [] };
}
