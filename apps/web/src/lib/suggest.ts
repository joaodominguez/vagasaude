import type { Job } from "@/lib/jobs";
import { districts, professions } from "@/lib/taxonomies";

export type SuggestItem = {
  label: string;
  value: string;
  kind: "profession" | "district" | "role" | "company";
  /** Se existir, navegar directamente (ex.: landing de categoria). */
  href?: string;
  hint?: string;
};

const ROLE_SEEDS = [
  "Enfermeiro",
  "Enfermeiro UCI",
  "Enfermeiro Bloco Operatório",
  "Médico",
  "Medicina Geral e Familiar",
  "Médico Dentista",
  "Fisioterapeuta",
  "Auxiliar de Ação Médica",
  "Técnico de Radiologia",
  "Técnico Auxiliar de Saúde",
  "Farmacêutico",
  "Rececionista",
  "Terapeuta da Fala",
  "Psicólogo",
];

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(label: string, query: string) {
  const n = normalize(label);
  const q = normalize(query);
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  const idx = n.indexOf(q);
  if (idx >= 0) return 60 - Math.min(idx, 20);
  // match por palavras
  const words = q.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((w) => n.includes(w))) return 50;
  return 0;
}

/** Sugestões a partir do inventário actual + taxonomias. */
export function buildSuggestions(
  jobs: Job[],
  query: string,
  limit = 8,
): SuggestItem[] {
  const q = query.trim();
  const seen = new Set<string>();
  const scored: Array<{ item: SuggestItem; score: number }> = [];

  const consider = (item: SuggestItem, boost = 0) => {
    const key = `${item.kind}:${normalize(item.value)}`;
    if (seen.has(key)) return;
    let score = q
      ? Math.max(scoreMatch(item.label, q), scoreMatch(item.value, q))
      : item.kind === "profession"
        ? 40
        : item.kind === "role"
          ? 30
          : 20;
    if (q && score <= 0) return;
    // Prefer taxonomias / seeds curtos face a títulos longos do inventário.
    score += boost;
    if (item.label.length <= 28) score += 4;
    else if (item.label.length > 48) score -= 8;
    seen.add(key);
    scored.push({ item, score });
  };

  for (const profession of professions) {
    consider(
      {
        label: profession,
        value: profession,
        kind: "profession",
        hint: "Profissão",
        href: `/vagas?profissao=${encodeURIComponent(profession)}`,
      },
      12,
    );
  }

  for (const district of districts) {
    consider(
      {
        label: district,
        value: district,
        kind: "district",
        hint: "Distrito",
        href: `/vagas?distrito=${encodeURIComponent(district)}`,
      },
      8,
    );
  }

  for (const role of ROLE_SEEDS) {
    consider(
      {
        label: role,
        value: role,
        kind: "role",
        hint: "Função",
        href: `/vagas?q=${encodeURIComponent(role)}`,
      },
      10,
    );
  }

  // Termos frequentes nos títulos publicados.
  const titleCounts = new Map<string, number>();
  const companies = new Map<string, number>();
  for (const job of jobs) {
    companies.set(job.company, (companies.get(job.company) || 0) + 1);
    // primeiras 6 palavras do título como “role”
    const short = job.title
      .replace(/\s*[|–—-]\s*/g, " ")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 6)
      .join(" ");
    if (short.length >= 8 && short.length <= 60) {
      titleCounts.set(short, (titleCounts.get(short) || 0) + 1);
    }
  }

  for (const [label, count] of titleCounts) {
    // Evitar frases genéricas de avisos públicos no autocomplete vazio.
    const n = normalize(label);
    if (
      n.startsWith("abertura de ") ||
      n.startsWith("aviso de ") ||
      n.startsWith("procedimento concursal")
    ) {
      if (!q || q.length < 4) continue;
    }
    if (count < 2 && q.length < 3) continue;
    consider({
      label,
      value: label,
      kind: "role",
      hint: "Função",
      href: `/vagas?q=${encodeURIComponent(label)}`,
    });
  }

  for (const [company, count] of companies) {
    if (count < 2 && !q) continue;
    consider({
      label: company,
      value: company,
      kind: "company",
      hint: "Entidade",
      href: `/vagas?q=${encodeURIComponent(company)}`,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "pt"));

  // Sem query: profissões + algumas funções, não distritos/empresas.
  if (!q) {
    return scored
      .filter((s) => s.item.kind === "profession" || s.item.kind === "role")
      .slice(0, limit)
      .map((s) => s.item);
  }

  return scored.slice(0, limit).map((s) => s.item);
}
