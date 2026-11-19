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

export function splitOffering(raw: string): { blocks: JobTextBlock[]; offering: string[] } {
  const blocks = formatJobDescriptionText(raw);
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
