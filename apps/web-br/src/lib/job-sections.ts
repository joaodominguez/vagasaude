/**
 * Separa da descrição a seção «O que oferecemos» (benefícios) para mostrá-la à parte,
 * como na maquete, e limpa blocos repetidos e texto legal de agências. Função pura:
 * se não encontrar um título claro seguido de uma lista, a descrição fica como está.
 */
import { formatJobDescriptionText, type JobTextBlock } from "@/lib/format-job-text";
import { foldText } from "@/lib/display-title";

const OFFER_HEADING_RE =
  /^(?:o\s+que\s+(?:a\s+gente\s+|nos\s+|n[oó]s\s+)?oferecemos|oferecemos|nossos\s+beneficios|beneficios(?:\s+e\s+vantagens)?|vantagens|o\s+que\s+voce\s+(?:vai\s+)?(?:encontra|recebe|ganha)|condicoes\s+oferecidas|pacote\s+de\s+beneficios|remuneracao\s+e\s+beneficios)\b/;

function isOfferHeading(text: string): boolean {
  const folded = foldText(text).replace(/[:?]+$/, "").trim();
  return folded.length <= 60 && OFFER_HEADING_RE.test(folded);
}

/**
 * Linhas de texto legal/boilerplate removidas só quando a linha é exatamente isto
 * (aviso de igualdade de oportunidades, «vaga afirmativa» padrão, referência a política
 * de privacidade/LGPD genérica, número de registro de agência).
 */
const BOILERPLATE_RES: RegExp[] = [
  /^(?:a|esta|nossa)?\s*(?:vaga|oportunidade|selecao|empresa)[^\n]{0,80}(?:todos os generos|independente de (?:genero|raca|cor|religiao)|diversidade e inclusao)[^\n]{0,120}$/i,
  /^(?:ao|para)\s+(?:se\s+)?(?:candidatar|enviar)[^\n]{0,80}(?:politica de privacidade|lgpd)[^\n]{0,120}$/i,
  /^(?:os\s+)?(?:dados|curriculos?)\s+(?:enviados|fornecidos)[^\n]{0,80}(?:lgpd|lei geral de protecao)[^\n]{0,120}$/i,
  /^(?:registro|autorizacao)\s+(?:no\s+)?(?:mte|ministerio do trabalho)[^\n]{0,80}$/i,
  /^[\p{L} .&']{3,50}\s*[-–—,]?\s*(?:cnpj|registro)\s*(?:n[ºo.]*)?\s*[\d./-]{8,20}$/iu,
];

function isBoilerplate(text: string): boolean {
  const line = foldText(text).replace(/\s+/g, " ").trim();
  return line.length <= 220 && BOILERPLATE_RES.some((re) => re.test(line));
}

function blockKey(block: JobTextBlock): string {
  const text = block.type === "list" ? block.items.join("|") : block.text;
  return `${block.type === "list" ? "l" : "t"}:${foldText(text).replace(/[^a-z0-9|]+/g, " ").trim()}`;
}

/**
 * Limpa os blocos: tira o boilerplate de agências e os blocos repetidos
 * (algumas fontes duplicam o texto); fica a primeira ocorrência.
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
