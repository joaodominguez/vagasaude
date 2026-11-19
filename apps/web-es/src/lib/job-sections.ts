/**
 * Separa de la descripción la sección «Qué ofrecemos» (beneficios) para mostrarla aparte,
 * como en la maqueta. Función pura: si no encuentra un encabezado claro seguido de una
 * lista, la descripción queda como está.
 */
import { formatJobDescriptionText, type JobTextBlock } from "@/lib/format-job-text";
import { foldText } from "@/lib/display-title";

const OFFER_HEADING_RE =
  /^(?:que\s+(?:te\s+)?ofrecemos|te\s+ofrecemos|ofrecemos|se\s+ofrece|condiciones(?:\s+ofrecidas)?|que\s+encontraras|por\s+que\s+(?:unirte|elegirnos|trabajar\s+con\s+nosotros)|ventajas(?:\s+de\s+trabajar\s+con\s+nosotros)?|beneficios|nuestra\s+oferta|oferta\s+de\s+trabajo\s+incluye)\b/;

/** Encabezados «crudos» (no reconocidos por format-job-text) que abren la sección. */
function isOfferHeading(text: string): boolean {
  const folded = foldText(text).replace(/[:?]+$/, "").trim();
  return folded.length <= 60 && OFFER_HEADING_RE.test(folded);
}

/**
 * Líneas de texto legal repetitivo de ETT/agencias, eliminadas solo cuando la línea es
 * exactamente eso (autorización de agencia de colocación, frase sobre «ambos sexos»,
 * remisión a la política de privacidad).
 */
const BOILERPLATE_RES: RegExp[] = [
  /^agencia\s+de\s+colocaci[oó]n\s+(?:n[ºo.°]?\s*)?[\w\/.\-– ]{0,30}$/i,
  /^[\p{L} .&']{3,50}\s*[-–—,]?\s*(?:autorizaci[oó]n|aut\.)\s+(?:de\s+)?agencia[^\n]{0,60}$/iu,
  /^(?:la presente|esta) (?:oferta|selecci[oó]n|convocatoria) [^\n]{0,80}(?:ambos sexos|hombres y mujeres|sin discriminaci[oó]n)[^\n]{0,80}$/i,
  /^(?:todas las candidaturas|los candidatos|las candidaturas)[^\n]{0,60}(?:ambos sexos|igualdad de oportunidades)[^\n]{0,80}$/i,
  /^(?:el|la) candidat[oa] [^\n]{0,40}pol[ií]tica de privacidad[^\n]{0,120}$/i,
  /^(?:al\s+(?:enviar|inscribirte|presentar)[^\n]{0,60})?(?:aceptas|consientes)[^\n]{0,60}(?:tratamiento de (?:tus )?datos|pol[ií]tica de privacidad|protecci[oó]n de datos)[^\n]{0,120}$/i,
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
 * Limpia los bloques: quita el texto legal de agencias y los bloques repetidos
 * (algunas fuentes duplican el texto); se queda con la primera aparición.
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
