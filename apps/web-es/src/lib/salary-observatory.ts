import { cache } from "react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";
import type { Career } from "@/lib/salary-tables";

/**
 * Retribuciones anunciadas en ofertas agregadas (en la práctica, sector privado
 * y concertado: las convocatorias del BOE no indican sueldo). Complementan las
 * tablas oficiales. Solo se muestran con muestra mínima.
 *
 * Criterios: importes en euros; "€/mes" se toma tal como se anuncia; importes
 * anuales ("€ brutos/año") se dividen entre 12 (mismo criterio que las
 * referencias del sitio: anual ÷ 12, pagas extra prorrateadas). Se excluyen
 * importes por hora/día, bandas vagas (máximo > 1,5 × mínimo), prácticas y
 * valores por debajo de 1.000 €/mes (jornada parcial).
 */

export const SALARY_MIN_SAMPLE = 5;
const LOOKBACK_DAYS = 180;
const MIN_MONTHLY = 1000;
const MAX_MONTHLY = 15000;
const EXCLUDED_SOURCES = new Set<string>(["boe"]);

const CAREER_PATTERNS: Record<string, RegExp> = {
  enfermero: /\benfermer|\bdue\b/,
  // Médico: sin muestra fiable ("médico" recoge guardias por hora y puestos
  // de consulta); la página muestra solo las tablas oficiales.
  tcae: /\btcae\b|auxiliar de enfermeria|cuidados auxiliares|gerocultor/,
  "tecnico-superior-sanitario":
    /tecnic[oa] superior|imagen para el diagnostico|laboratorio|anatomia patologica|radioterapia|higienista|radiodiagnostico/,
  fisioterapeuta: /fisioterap/,
  celador: /\bcelador/,
  farmaceutico: /\bfarmaceutic/,
};

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function toNumber(token: string) {
  const t = token.replace(/\s/g, "");
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

/** "1.230 €/mes", "25.000 € brutos/año", "De 24.000€ a 27.000€" → mensual (anual ÷ 12). */
export function parseMonthlySalaryEur(raw: string | null | undefined) {
  if (!raw) return null;
  const text = normalize(raw);
  if (/\bhora\b|\/\s*h\b|por hora|\bdia\b|\/\s*dia|diari|segun convenio|a convenir/.test(text)) {
    return null;
  }
  const values = [...raw.matchAll(/\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g)]
    .map((m) => toNumber(m[0]))
    .filter((v) => Number.isFinite(v) && v >= 300);
  if (values.length === 0) return null;
  const pair = values.slice(0, 2);
  if (pair.length === 2 && Math.max(...pair) > 1.5 * Math.min(...pair)) return null;
  let value = pair.reduce((sum, v) => sum + v, 0) / pair.length;
  if (/anual|\/\s*a(n|ñ)o|\bano\b|al ano/.test(text) || value >= 9000) value /= 12;
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
  return /practicas|becario|beca\b|\bmir\b|residente/.test(
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

/** Estadísticas de ofertas con sueldo para la carrera (null si la muestra es pequeña). */
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
