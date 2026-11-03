import { cache } from "react";
import { listAllStoredJobs, type StoredJob } from "@/lib/job-store";
import {
  categoryPath,
  listEligibleCategories,
  toCategorySlug,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";

/**
 * Observatório de salários: salários reais anunciados pelos próprios empregadores
 * nas vagas (ativas e expiradas dos últimos meses). Só publica com amostra mínima.
 *
 * Fora da amostra: concursos agregados (PCI junta vários cargos num anúncio e o
 * valor pode ser de outro cargo ou até a taxa de inscrição), residências, estágios,
 * valores por hora/plantão/dia e bolsas.
 */

export const SALARY_MIN_SAMPLE = 5;
const LOOKBACK_DAYS = 180;
const EXCLUDED_SOURCES = new Set(["pci_concursos"]);

export type SalaryRole = {
  slug: string;
  /** "técnico de enfermagem" (no meio de frase). */
  label: string;
  pattern: RegExp;
  /** Landing de vagas relacionada (profissão da taxonomia ou sub-landing). */
  hubProfession: string;
  /** Piso legal nacional (44 h semanais), quando existe. */
  floor?: { value: number; note: string };
};

const NURSING_FLOOR_NOTE =
  "Lei 14.434/2022, para 44 h semanais. Na prática aplica-se de forma proporcional à jornada, com regras próprias para o setor público e filantrópico definidas pelo STF.";

export const SALARY_ROLES: SalaryRole[] = [
  {
    slug: "tecnico-de-enfermagem",
    label: "técnico de enfermagem",
    pattern: /\btecnic[oa].{0,8}enferm/,
    hubProfession: "Técnico de Enfermagem",
    floor: { value: 3325, note: NURSING_FLOOR_NOTE },
  },
  {
    slug: "auxiliar-de-enfermagem",
    label: "auxiliar de enfermagem",
    pattern: /\bauxiliar.{0,6}enferm/,
    hubProfession: "Auxiliar de Enfermagem",
    floor: { value: 2375, note: NURSING_FLOOR_NOTE },
  },
  {
    slug: "enfermeiro",
    label: "enfermeiro",
    pattern: /\benfermeir/,
    hubProfession: "Enfermagem",
    floor: { value: 4750, note: NURSING_FLOOR_NOTE },
  },
  {
    slug: "farmaceutico",
    label: "farmacêutico",
    pattern: /\bfarmaceutic/,
    hubProfession: "Farmácia",
  },
  {
    slug: "auxiliar-de-farmacia",
    label: "auxiliar de farmácia",
    pattern: /\bauxiliar.{0,6}farm|\batendente de farm/,
    hubProfession: "Farmácia",
  },
  {
    slug: "fisioterapeuta",
    label: "fisioterapeuta",
    pattern: /\bfisioterap/,
    hubProfession: "Fisioterapia",
  },
  {
    slug: "nutricionista",
    label: "nutricionista",
    pattern: /\bnutricionist/,
    hubProfession: "Nutrição",
  },
  {
    slug: "psicologo",
    label: "psicólogo",
    pattern: /\bpsicolog/,
    hubProfession: "Psicologia",
  },
  {
    slug: "assistente-social",
    label: "assistente social",
    pattern: /\bassistente social/,
    hubProfession: "Assistência Social",
  },
  {
    slug: "tecnico-de-radiologia",
    label: "técnico de radiologia",
    pattern: /\btecnic[oa].{0,8}radiolog/,
    hubProfession: "Técnico de Saúde",
  },
  {
    slug: "recepcionista",
    label: "recepcionista",
    pattern: /\brecepcion/,
    hubProfession: "Administrativo",
  },
  {
    slug: "auxiliar-administrativo",
    label: "auxiliar administrativo",
    pattern: /\b(auxiliar|assistente) administrativ/,
    hubProfession: "Administrativo",
  },
];

export type SalaryObservation = {
  role: SalaryRole;
  amount: number;
  district: string;
  company: string;
  active: boolean;
  slug: string;
  title: string;
  salaryText: string;
  seenAt: string;
};

export type SalaryStats = {
  count: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
};

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "R$ 2.000,00 – R$ 3.000,00 / mês" → 2500. Null se não for um valor mensal fiável. */
export function parseMonthlySalary(raw: string | null | undefined) {
  if (!raw) return null;
  const text = normalize(raw);
  if (/hora|\/h\b|plant|diaria|\bdia\b|bolsa|anual|\/ano/.test(text)) return null;
  const values = [...raw.matchAll(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g)]
    .map((m) => Number(m[0].replaceAll(".", "").replace(",", ".")))
    .filter((v) => v >= 1100 && v <= 40000);
  if (values.length === 0) return null;
  const pair = values.slice(0, 2);
  return pair.reduce((sum, v) => sum + v, 0) / pair.length;
}

function roleFor(title: string) {
  const t = normalize(title);
  return SALARY_ROLES.find((role) => role.pattern.test(t)) ?? null;
}

function isExcluded(job: StoredJob) {
  if (EXCLUDED_SOURCES.has(job.source)) return true;
  const context = normalize(`${job.title} ${job.contractType ?? ""}`);
  return /residen|estagi|aprendiz/.test(context);
}

/** Todas as observações (deduplicadas: mesma entidade, função, valor e estado = 1). */
export const getSalaryObservations = cache(async () => {
  const since = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const out: SalaryObservation[] = [];
  for (const job of await listAllStoredJobs()) {
    if (job.status !== "published" && job.status !== "expired") continue;
    if (!job.salary || isExcluded(job)) continue;
    const seenAt = job.lastSeenAt || job.updatedAt || job.createdAt;
    if (Date.parse(seenAt) < since) continue;
    const amount = parseMonthlySalary(job.salary);
    const role = amount ? roleFor(job.title) : null;
    if (!amount || !role) continue;
    const key = [role.slug, job.company, Math.round(amount), job.locationDistrict].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      role,
      amount,
      district: job.locationDistrict,
      company: job.company,
      active: job.status === "published",
      slug: job.slug,
      title: job.title,
      salaryText: job.salary,
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

export function salaryStats(observations: SalaryObservation[]): SalaryStats {
  const sorted = observations.map((o) => o.amount).sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export function roleFromSlug(slug: string) {
  return SALARY_ROLES.find((role) => role.slug === slug) ?? null;
}

export function salaryPath(role: SalaryRole, district?: string | null) {
  return district
    ? `/salarios/${role.slug}/${toCategorySlug(district)}`
    : `/salarios/${role.slug}`;
}

/** Landing de vagas da função (e do estado, se existir); senão a da função ou /vagas. */
export async function salaryJobsHref(role: SalaryRole, district?: string | null) {
  const eligible = new Set(listEligibleCategories(await getJobs()).map((ref) => ref.path));
  const candidates = [
    district ? categoryPath(role.hubProfession, district) : null,
    categoryPath(role.hubProfession, null),
  ];
  return candidates.find((path) => path && eligible.has(path)) ?? "/vagas";
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export type SalaryPage = {
  role: SalaryRole;
  district: string | null;
  path: string;
  stats: SalaryStats;
};

/** Páginas publicáveis (amostra ≥ SALARY_MIN_SAMPLE): função e função × estado. */
export const listSalaryPages = cache(async (): Promise<SalaryPage[]> => {
  const observations = await getSalaryObservations();
  const pages: SalaryPage[] = [];
  for (const list of groupBy(observations, (o) => o.role.slug).values()) {
    if (list.length < SALARY_MIN_SAMPLE) continue;
    const role = list[0].role;
    pages.push({ role, district: null, path: salaryPath(role), stats: salaryStats(list) });
    for (const [district, byState] of groupBy(list, (o) => o.district)) {
      // Estado com todas as vagas da função = página nacional repetida: não publicar.
      if (!district || byState.length < SALARY_MIN_SAMPLE || byState.length === list.length) {
        continue;
      }
      pages.push({
        role,
        district,
        path: salaryPath(role, district),
        stats: salaryStats(byState),
      });
    }
  }
  return pages.sort((a, b) => b.stats.count - a.stats.count);
});

/** Dados de uma página (null se não existir ou a amostra for pequena). */
export async function getSalaryPage(roleSlug: string, stateSlug?: string) {
  const role = roleFromSlug(roleSlug);
  if (!role) return null;
  const all = (await getSalaryObservations()).filter((o) => o.role.slug === role.slug);
  const district = stateSlug
    ? (all.find((o) => toCategorySlug(o.district) === stateSlug)?.district ?? null)
    : null;
  if (stateSlug && !district) return null;
  const observations = district ? all.filter((o) => o.district === district) : all;
  if (observations.length < SALARY_MIN_SAMPLE) return null;
  if (district && observations.length === all.length) return null;

  const byGroup = (key: (o: SalaryObservation) => string, min: number) =>
    [...groupBy(observations, key)]
      .filter(([name, list]) => name && list.length >= min)
      .map(([name, list]) => ({ name, stats: salaryStats(list) }))
      .sort((a, b) => b.stats.count - a.stats.count || b.stats.median - a.stats.median);

  const pages = await listSalaryPages();
  return {
    role,
    district,
    stats: salaryStats(observations),
    byState: district ? [] : byGroup((o) => o.district, 3),
    byCompany: byGroup((o) => o.company, 2).slice(0, 12),
    openJobs: observations
      .filter((o) => o.active)
      .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
      .slice(0, 10),
    statePages: new Set(
      pages.filter((p) => p.role.slug === role.slug && p.district).map((p) => p.path),
    ),
    updatedAt: observations.reduce((latest, o) => (o.seenAt > latest ? o.seenAt : latest), ""),
  };
}

/** Página de salário da profissão de uma landing de vagas (para ligações internas). */
export async function salaryPathForProfession(profession: string | null) {
  if (!profession) return null;
  const pages = await listSalaryPages();
  const page = pages.find((p) => !p.district && p.role.hubProfession === profession);
  return page?.path ?? null;
}
