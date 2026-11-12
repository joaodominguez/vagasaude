import type { Job } from "@/lib/jobs";
import { districts, professions } from "@/lib/taxonomies";
import { PROVINCES_BY_REGION } from "@/lib/provinces";

export type SuggestItem = {
  label: string;
  value: string;
  kind: "profession" | "district" | "province" | "role" | "company";
  /** Se presente, naviga direttamente (es. landing di categoria). */
  href?: string;
  hint?: string;
};

const ROLE_SEEDS = [
  "Infermiere",
  "Infermiere di sala operatoria",
  "Infermiere di terapia intensiva",
  "Infermiere di pronto soccorso",
  "Ostetrica",
  "Medico di medicina generale",
  "Dirigente medico",
  "Medico di pronto soccorso",
  "Pediatra",
  "Odontoiatra",
  "Fisioterapista",
  "OSS",
  "Operatore socio sanitario",
  "Tecnico sanitario di radiologia medica",
  "Tecnico di laboratorio biomedico",
  "Farmacista",
  "Assistente sociale",
  "Educatore professionale",
  "Logopedista",
  "Psicologo",
  "Dietista",
  "Coordinatore infermieristico",
  "Assistente amministrativo",
  "Formatore",
];

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
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
  // corrispondenza per parole
  const words = q.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((w) => n.includes(w))) return 50;
  return 0;
}

/** Suggerimenti a partire dalle offerte attuali e dalle tassonomie. */
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
    // Meglio tassonomie e seed brevi rispetto ai titoli lunghi delle offerte.
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
        hint: "Professione",
        href: `/offerte?professione=${encodeURIComponent(profession)}`,
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
        hint: "Regione",
        href: `/offerte?regione=${encodeURIComponent(district)}`,
      },
      8,
    );
  }

  for (const [region, provinces] of Object.entries(PROVINCES_BY_REGION)) {
    for (const province of provinces) {
      consider(
        {
          label: province,
          value: province,
          kind: "province",
          hint: `Provincia · ${region}`,
          href: `/offerte?q=${encodeURIComponent(province)}`,
        },
        6,
      );
    }
  }

  for (const role of ROLE_SEEDS) {
    consider(
      {
        label: role,
        value: role,
        kind: "role",
        hint: "Ruolo",
        href: `/offerte?q=${encodeURIComponent(role)}`,
      },
      10,
    );
  }

  // Termini frequenti nei titoli pubblicati.
  const titleCounts = new Map<string, number>();
  const companies = new Map<string, number>();
  for (const job of jobs) {
    companies.set(job.company, (companies.get(job.company) || 0) + 1);
    // prime 6 parole del titolo come “ruolo”
    const short = job.title
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\s*[|–—-]\s*/g, " ")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 6)
      .join(" ");
    if (short.length >= 8 && short.length <= 48) {
      titleCounts.set(short, (titleCounts.get(short) || 0) + 1);
    }
  }

  for (const [label, count] of titleCounts) {
    // Evitare le formule generiche degli avvisi pubblici nell'autocompletamento vuoto.
    const n = normalize(label);
    if (
      n.startsWith("avviso pubblico") ||
      n.startsWith("avviso di ") ||
      n.startsWith("indizione ") ||
      n.startsWith("concorso pubblico")
    ) {
      if (!q || q.length < 4) continue;
    }
    if (count < 2 && q.length < 3) continue;
    consider({
      label,
      value: label,
      kind: "role",
      hint: "Ruolo",
      href: `/offerte?q=${encodeURIComponent(label)}`,
    });
  }

  for (const [company, count] of companies) {
    if (count < 2 && !q) continue;
    consider({
      label: company,
      value: company,
      kind: "company",
      hint: "Azienda",
      href: `/offerte?q=${encodeURIComponent(company)}`,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "it"));

  // Senza query: professioni e alcuni ruoli, non regioni/aziende.
  if (!q) {
    return scored
      .filter((s) => s.item.kind === "profession" || s.item.kind === "role")
      .slice(0, limit)
      .map((s) => s.item);
  }

  return scored.slice(0, limit).map((s) => s.item);
}
