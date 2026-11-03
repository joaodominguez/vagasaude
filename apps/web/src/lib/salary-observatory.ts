import { cache } from "react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";
import type { Career } from "@/lib/salary-tables";

/**
 * Salários anunciados no privado (e IPSS) nas vagas agregadas: complementam as
 * tabelas oficiais do SNS. Só mostramos com amostra mínima.
 *
 * Fora da amostra: BEP e SCML (remetem para tabelas públicas/acordo de empresa, já
 * mostradas), SAPO Emprego (só escalões genéricos, ex. "De 15.000€ a 25.000€"), estágios, valores por hora/dia, e valores abaixo do salário mínimo
 * (tempo parcial). Valores anuais são convertidos para 14 meses.
 */

export const SALARY_MIN_SAMPLE = 5;
const LOOKBACK_DAYS = 180;
const MINIMUM_WAGE = 920;
const EXCLUDED_SOURCES = new Set(["bep", "scml", "sapo_emprego"]);

const CAREER_PATTERNS: Record<string, RegExp> = {
  enfermeiro: /\benfermeir/,
  // Médico: sem amostra fiável no privado ("médico" apanha assistentes de consultório
  // e anúncios à hora); a página mostra só a tabela do SNS.
  "tecnico-superior-de-diagnostico-e-terapeutica":
    /fisioterap|radiolog|analises clinicas|cardiopneumolog|terapeuta da fala|terapeuta ocupacional|tecnic[oa] de farmacia|dietista|ortoptist|higienista oral|neurofisiolog/,
  "tecnico-auxiliar-de-saude": /auxiliar de saude|auxiliar de acao medica|tecnic[oa] auxiliar de saude/,
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

/** "1270 €/mês", "1.300€", "1499.15 €", "21.350€ – 27.300€ (anual)" → mensal (14 meses). */
export function parseMonthlySalaryEur(raw: string | null | undefined) {
  if (!raw) return null;
  const text = normalize(raw);
  if (/hora|\/h\b|\bdia\b|diaria|posicao remuneratoria|tru\b|acordo de empresa/.test(text)) {
    return null;
  }
  const values = [...raw.matchAll(/\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g)]
    .map((m) => toNumber(m[0]))
    .filter((v) => Number.isFinite(v) && v >= 300);
  if (values.length === 0) return null;
  const pair = values.slice(0, 2);
  let value = pair.reduce((sum, v) => sum + v, 0) / pair.length;
  if (/anual|\/ano|\bano\b/.test(text) || value >= 9000) value /= 14;
  return value >= MINIMUM_WAGE && value <= 15000 ? value : null;
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
  return /estagi|internato/.test(normalize(`${job.title} ${job.contractType ?? ""}`));
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

/** Estatísticas do privado para a carreira (null se a amostra for pequena). */
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
