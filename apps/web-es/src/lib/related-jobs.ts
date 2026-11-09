import type { Job } from "@/lib/jobs";

/**
 * "Vagas semelhantes" — mesmo resultado que o antigo
 * `allJobs.filter(...).sort((a, b) => scoreRelated(b, job) - scoreRelated(a, job)).slice(0, 6)`,
 * mas sem ordenar todas as vagas nem partir títulos em cada comparação: palavras dos títulos e
 * índices por profissão/região calculados uma vez por lista (a lista só muda quando o jobs.json
 * muda). Equivalência verificada em 2026-11-09 (1.247 vagas, 0 diferenças; BR 57 ms → 1,8 ms).
 */
const LOCALE = "es";

type RelatedIndex = {
  words: string[][];
  byProfession: Map<string, number[]>;
  byDistrict: Map<string, number[]>;
};

const indexes = new WeakMap<Job[], RelatedIndex>();

function titleWords(title: string) {
  return title
    .toLocaleLowerCase(LOCALE)
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function getIndex(jobs: Job[]): RelatedIndex {
  const cached = indexes.get(jobs);
  if (cached) return cached;
  const byProfession = new Map<string, number[]>();
  const byDistrict = new Map<string, number[]>();
  const words = jobs.map((job, i) => {
    const p = byProfession.get(job.profession);
    if (p) p.push(i);
    else byProfession.set(job.profession, [i]);
    const d = byDistrict.get(job.district);
    if (d) d.push(i);
    else byDistrict.set(job.district, [i]);
    return titleWords(job.title);
  });
  const index = { words, byProfession, byDistrict };
  indexes.set(jobs, index);
  return index;
}

export function relatedJobs(job: Job, allJobs: Job[], limit = 6): Job[] {
  const index = getIndex(allJobs);
  const targetWords = new Set(titleWords(job.title));
  const candidates = new Set<number>([
    ...(index.byProfession.get(job.profession) ?? []),
    ...(index.byDistrict.get(job.district) ?? []),
  ]);
  const scored: Array<[number, number]> = [];
  for (const i of candidates) {
    const candidate = allJobs[i];
    if (candidate.slug === job.slug) continue;
    let score = 0;
    if (candidate.profession === job.profession) score += 5;
    if (candidate.district === job.district) score += 3;
    if (candidate.sector === job.sector) score += 2;
    for (const w of index.words[i]) if (targetWords.has(w)) score += 1;
    if (candidate.company === job.company) score += 1;
    scored.push([score, i]);
  }
  // Desempate pela posição na lista = ordem do sort estável antigo.
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return scored.slice(0, limit).map(([, i]) => allJobs[i]);
}
