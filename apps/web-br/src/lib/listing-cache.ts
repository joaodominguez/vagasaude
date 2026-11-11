import type { Job } from "@/lib/jobs";
import { isCategoryEligible } from "@/lib/categories";
import { contractBucket } from "@/lib/contracts";

/**
 * Caches da listagem com pesquisa, por versão dos dados: a lista de vagas é o mesmo array (e os
 * mesmos objetos) enquanto a base não muda, por isso WeakMap chega — quando chega um ingest, a lista
 * nova tem cache nova e a antiga é libertada. Os resultados são exatamente os mesmos de antes; só
 * deixam de ser recalculados em cada pedido (o painel de filtros é desenhado 2× por pedido).
 */
const haystacks = new WeakMap<Job, string>();

/** Texto onde a pesquisa procura (título, entidade, profissão, descrição), em minúsculas. */
export function searchHaystack(job: Job, locale: string) {
  let value = haystacks.get(job);
  if (value === undefined) {
    value = `${job.title} ${job.company} ${job.profession} ${job.description}`.toLocaleLowerCase(
      locale,
    );
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

/** Nº de vagas por distrito/estado, profissão, setor e tipo de contrato (uma só passagem). */
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

/** isCategoryEligible com cache por versão dos dados. */
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
