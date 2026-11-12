import type { Job } from "@/lib/jobs";
import { isCategoryEligible } from "@/lib/categories";
import { contractBucket } from "@/lib/contracts";

/**
 * Cache dell'elenco con ricerca, per versione dei dati: l'elenco delle offerte è lo stesso array (e
 * gli stessi oggetti) finché la base non cambia, quindi basta una WeakMap: quando arriva un ingest,
 * il nuovo elenco ha una cache nuova e quella vecchia viene rilasciata. I risultati non cambiano; si
 * evita solo di ricalcolarli a ogni richiesta (il pannello filtri viene disegnato 2 volte per richiesta).
 */
const haystacks = new WeakMap<Job, string>();

/** Testo su cui agisce la ricerca (titolo, azienda, professione, descrizione), minuscolo e senza accenti. */
export function searchHaystack(job: Job, locale: string) {
  let value = haystacks.get(job);
  if (value === undefined) {
    value = `${job.title} ${job.company} ${job.profession} ${job.description}`
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase(locale);
    haystacks.set(job, value);
  }
  return value;
}

export type FacetCounts = {
  district: Map<string, number>;
  profession: Map<string, number>;
  sector: Map<string, number>;
  contract: Map<string, number>;
};

const facets = new WeakMap<Job[], FacetCounts>();

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** N. di offerte per regione, professione, settore e tipo di contratto (un solo passaggio). */
export function facetCounts(jobs: Job[]): FacetCounts {
  let counts = facets.get(jobs);
  if (!counts) {
    counts = { district: new Map(), profession: new Map(), sector: new Map(), contract: new Map() };
    for (const job of jobs) {
      bump(counts.district, job.district);
      bump(counts.profession, job.profession);
      bump(counts.sector, job.sector);
      bump(counts.contract, contractBucket(job.contract));
    }
    facets.set(jobs, counts);
  }
  return counts;
}

const eligible = new WeakMap<Job[], Map<string, boolean>>();

/** isCategoryEligible con cache per versione dei dati. */
export function categoryEligibleCached(
  jobs: Job[],
  profession: string | null,
  district: string | null,
) {
  let cache = eligible.get(jobs);
  if (!cache) {
    cache = new Map();
    eligible.set(jobs, cache);
  }
  const key = `${profession ?? ""}|${district ?? ""}`;
  let value = cache.get(key);
  if (value === undefined) {
    value = isCategoryEligible(jobs, profession, district);
    cache.set(key, value);
  }
  return value;
}
