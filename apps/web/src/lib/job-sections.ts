/**
 * Separa da descrição a secção «O que oferecemos» (benefícios) para a mostrar à parte,
 * como na maqueta. Função pura: se não encontrar um cabeçalho claro seguido de uma
 * lista, a descrição fica como está.
 */
import { formatJobDescriptionText, type JobTextBlock } from "@/lib/format-job-text";
import { foldText } from "@/lib/display-title";

const OFFER_HEADING_RE =
  /^(?:o\s+que\s+(?:te\s+|lhe\s+|vos\s+)?oferecemos|oferecemos|condicoes(?:\s+oferecidas)?|poder[aá]\s+contar\s+com|podes\s+contar\s+com|como\s+e\s+que\s+nos\s+cuidamos\s+de\s+si|beneficios|regalias|vantagens(?:\s+de\s+trabalhar\s+connosco)?|a\s+nossa\s+oferta|porque\s+(?:trabalhar|juntar-te|escolher)\s+\w+)\b/;

/** Cabeçalhos «crus» (não reconhecidos pelo format-job-text) que abrem a secção. */
function isOfferHeading(text: string): boolean {
  const folded = foldText(text).replace(/[:?]+$/, "").trim();
  return folded.length <= 60 && OFFER_HEADING_RE.test(folded);
}

/**
 * Linhas de texto legal repetitivo de agências/ETT, eliminadas só quando a linha é
 * exatamente isso (alvará de agência, frase sobre «ambos os sexos», autorização RGPD).
 */
const BOILERPLATE_RES: RegExp[] = [
  /^[\p{L} .&']{3,50}\s*[-–—,]?\s*(?:alvar[aá]|licen[cç]a)\s*(?:n[.º°]*\s*)?[\w/.-]{1,20}$/iu,
  /^(?:empresa\s+de\s+trabalho\s+tempor[aá]rio|ag[eê]ncia\s+de\s+coloca[cç][aã]o)[^\n]{0,80}$/i,
  /^(?:a\s+presente|esta|este)\s+(?:oferta|an[uú]ncio|sele[cç][aã]o|processo)[^\n]{0,80}(?:ambos\s+os\s+(?:sexos|g[eé]neros)|homens\s+e\s+mulheres|sem\s+discrimina[cç][aã]o)[^\n]{0,80}$/i,
  /^(?:todas\s+as\s+candidaturas|as\s+candidaturas|os\s+candidatos)[^\n]{0,80}(?:confidencialidade|ambos\s+os\s+sexos|igualdade\s+de\s+oportunidades)[^\n]{0,100}$/i,
  /^ao\s+(?:responder|enviar|submeter)\s+[^\n]{0,100}(?:autoriz|consent|concord)[^\n]{0,260}(?:dados|rgpd|privacidade)[^\n]*$/i,
];

function isBoilerplate(text: string): boolean {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= 420 && BOILERPLATE_RES.some((re) => re.test(line));
}

function blockKey(block: JobTextBlock): string {
  const text = block.type === "list" ? block.items.join("|") : block.text;
  return `${block.type === "list" ? "l" : "t"}:${foldText(text).replace(/[^a-z0-9|]+/g, " ").trim()}`;
}

/**
 * Limpa os blocos: tira o texto legal de agências e os blocos repetidos
 * (algumas fontes duplicam o texto); fica com a primeira ocorrência.
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
