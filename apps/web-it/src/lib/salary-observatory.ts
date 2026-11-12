import { cache } from "react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";
import type { Career } from "@/lib/salary-tables";

/**
 * Retribuzioni indicate negli annunci aggregati (in pratica settore privato e
 * accreditato: i bandi di concorso pubblici raramente indicano importi).
 * Completano le tabelle ufficiali. Mostrate solo con un campione minimo.
 *
 * DATI: provengono esclusivamente dagli annunci reali raccolti, mai da cifre
 * inventate. Le tabelle ufficiali di confronto devono citare una fonte
 * pubblica (es. CCNL Comparto Sanità, CCNL Dirigenza medica e sanitaria):
 * vedi `lib/salary-tables.ts`. Senza professioni in `CAREER_PATTERNS` la
 * funzione `getPrivateSalaryData` restituisce sempre null.
 *
 * Criteri: importi in euro; "€/mese" è preso così com'è; gli importi annui
 * ("€ lordi/anno", RAL) sono divisi per 12. Si escludono importi orari o
 * giornalieri, forbici vaghe (massimo > 1,5 × minimo), tirocini e valori sotto
 * i 1.000 €/mese (part-time).
 */

export const SALARY_MIN_SAMPLE = 5;
const LOOKBACK_DAYS = 180;
const MIN_MONTHLY = 1000;
const MAX_MONTHLY = 15000;
const EXCLUDED_SOURCES = new Set<string>();

/** slug professione (lib/salary-tables.ts) -> regex sul titolo normalizzato (senza accenti, minuscolo). */
const CAREER_PATTERNS: Record<string, RegExp> = {};

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumber(token: string) {
  const t = token.replace(/\s/g, "");
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

/** "1.230 €/mese", "25.000 € lordi/anno", "da 24.000€ a 27.000€" -> mensile (annuo ÷ 12). */
export function parseMonthlySalaryEur(raw: string | null | undefined) {
  if (!raw) return null;
  const text = normalize(raw);
  if (/\bora\b|\/\s*h\b|all'ora|orari[oa]|\bgiorn|\/\s*g\b|a giornata|secondo ccnl|da ccnl|da contratto|da definire|\bral da concordare/.test(text)) {
    return null;
  }
  const values = [...raw.matchAll(/\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g)]
    .map((m) => toNumber(m[0]))
    .filter((v) => Number.isFinite(v) && v >= 300);
  if (values.length === 0) return null;
  const pair = values.slice(0, 2);
  if (pair.length === 2 && Math.max(...pair) > 1.5 * Math.min(...pair)) return null;
  let value = pair.reduce((sum, v) => sum + v, 0) / pair.length;
  if (/annu|\bral\b|\/\s*anno|\banno\b|all'anno|l'anno/.test(text) || value >= 9000) value /= 12;
  return value >= MIN_MONTHLY && value <= MAX_MONTHLY ? value : null;
}

export type PrivateSalaryAd = {
  slug: string;
  title: string;
  company: string;
  district: string;
  salaryText: string;
  amount: number;
  active: boolean;
  seenAt: string;
};

function isExcluded(job: StoredJob) {
  if (EXCLUDED_SOURCES.has(job.source)) return true;
  return /tirocin|stage|borsa di studio|specializzand|volontari/.test(
    normalize(`${job.title} ${job.contractType ?? ""}`),
  );
}

const getAds = cache(async () => {
  const since = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const out: Array<PrivateSalaryAd & { careerSlug: string }> = [];
  const seen = new Set<string>();
  for (const job of await listAllStoredJobs()) {
    if (job.status !== "published" && job.status !== "expired") continue;
    if (!job.salary || isExcluded(job)) continue;
    const seenAt = job.lastSeenAt || job.updatedAt || job.createdAt;
    if (Date.parse(seenAt) < since) continue;
    const amount = parseMonthlySalaryEur(job.salary);
    if (!amount) continue;
    const title = normalize(job.title);
    const careerSlug = Object.entries(CAREER_PATTERNS).find(([, rx]) => rx.test(title))?.[0];
    if (!careerSlug) continue;
    const key = [careerSlug, job.company, Math.round(amount), job.locationDistrict].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      careerSlug,
      slug: job.slug,
      title: job.title,
      company: job.company,
      district: job.locationDistrict,
      salaryText: job.salary,
      amount,
      active: job.status === "published",
      seenAt,
    });
  }
  return out;
});

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Statistiche sugli annunci con retribuzione per la professione (null se il campione è piccolo). */
export async function getPrivateSalaryData(career: Career) {
  const ads = (await getAds()).filter((ad) => ad.careerSlug === career.slug);
  if (ads.length < SALARY_MIN_SAMPLE) return null;
  const sorted = ads.map((ad) => ad.amount).sort((a, b) => a - b);
  return {
    count: ads.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    recent: ads
      .filter((ad) => ad.active)
      .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
      .slice(0, 8),
  };
}
