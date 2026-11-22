import { listClosedBeyondWindow, slugify } from "@/lib/job-store";
import { concorsiPath, listConcorsi, listEligibleConcorsi } from "@/lib/concorsi";

/**
 * A5: concorsi pubblici chiusi da piu' di 90 giorni → 301 verso la pagina piu' pertinente:
 *  1. /concorsi/<professione>/<regione>, se esiste (almeno 3 bandi aperti);
 *  2. altrimenti /concorsi/<professione> (almeno 1 bando aperto);
 *  3. altrimenti /concorsi.
 * Usato da proxy.ts (non da redirect() nella pagina: Next 16 duplica l'header Location alla prima risposta).
 */
let cache: { source: object; targets: Map<string, string> } | null = null;

export async function listExpiredRedirectTargets(): Promise<Map<string, string>> {
  const { cards, entries, source } = await listClosedBeyondWindow();
  if (cache?.source === source) return cache.targets;
  const eligible = new Set(listEligibleConcorsi(listConcorsi(cards)).map((ref) => ref.path));
  const targets = new Map<string, string>();
  for (const entry of entries) {
    const combo = concorsiPath(entry.profession, entry.district);
    const profession = concorsiPath(entry.profession);
    targets.set(
      entry.key,
      eligible.has(combo) ? combo : eligible.has(profession) ? profession : "/concorsi",
    );
  }
  cache = { source, targets };
  return targets;
}

/** Destinazione del 301 per questo slug, o null (pagina viva, privata, entro 90 giorni, sconosciuta). */
export async function expiredConcorsoRedirectTarget(slug: string): Promise<string | null> {
  const targets = await listExpiredRedirectTargets();
  return targets.get(slug) ?? targets.get(slugify(slug)) ?? null;
}
