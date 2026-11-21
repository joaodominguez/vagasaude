import type { Job } from "@/lib/jobs";
import { isPublicJob } from "@/lib/job-type";

/** Finestra in cui un concorso pubblico scaduto resta indicizzabile (index,follow, senza JobPosting). */
export const EXPIRED_INDEXABLE_DAYS = 90;

export type ExpiredClosure = { at: number; kind: "deadline" | "gone" };

/**
 * Concorso/avviso del settore pubblico scaduto da <= 90 giorni: la pagina resta 200, index,follow,
 * senza JobPosting (Google lo vuole cosi' per le offerte chiuse), con avviso «scaduto» e bandi aperti
 * simili. Privati/agenzie e scaduti da oltre 90 giorni: comportamento invariato (noindex).
 * `closure` viene dal job-store (expiredClosure): null per avvisi di esito, stati nascosti, ecc.
 */
export function expiredConcorsoClosure(
  job: Job,
  closure: ExpiredClosure | null | undefined,
  now: number = Date.now(),
): ExpiredClosure | null {
  if (!closure || !isPublicJob(job)) return null;
  if (now - closure.at > EXPIRED_INDEXABLE_DAYS * 86_400_000) return null;
  return closure;
}

const ROME_DATE = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatClosureDate(at: number): string {
  return ROME_DATE.format(at);
}
