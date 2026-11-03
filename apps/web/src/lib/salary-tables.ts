/**
 * Tabelas salariais oficiais das carreiras da saúde (SNS / Administração Pública) e
 * cálculo do salário líquido estimado. Fontes:
 * - DGAEP, "Sistema Remuneratório da Administração Pública 2026" (TRU atualizada pelo
 *   Decreto-Lei n.º 29-A/2026, de 30 de janeiro);
 * - Despacho n.º 233-A/2026 (DR, 2.ª série, 6/1/2026): tabelas de retenção na fonte de IRS,
 *   trabalho dependente, continente.
 * Valores mensais brutos (ilíquidos), em euros. Atualizar quando sair nova TRU/despacho.
 */

export const SALARY_YEAR = 2026;

export const SALARY_SOURCES = [
  {
    label: "DGAEP — Sistema Remuneratório da Administração Pública 2026",
    url: "https://www.dgaep.gov.pt/upload//catalogo/SRAP_2026.pdf",
  },
  {
    label: "Despacho n.º 233-A/2026 — tabelas de retenção na fonte de IRS (continente)",
    url: "https://files.diariodarepublica.pt/2s/2026/01/003000001/0000200010.pdf",
  },
];

export type PayPosition = { position: number; level: number; gross: number };
export type PayCategory = { name: string; positions: PayPosition[] };
export type Career = {
  slug: string;
  /** "enfermeiro" (no meio de frase). */
  label: string;
  /** Nome da carreira no SNS. */
  careerName: string;
  /** Regime de horário das tabelas apresentadas. */
  regime: string;
  categories: PayCategory[];
  /** Profissões incluídas (para carreiras que juntam várias). */
  includes?: string[];
  /** Profissão da taxonomia do site (landing de vagas). */
  profession: string;
  intro: string;
};

function positions(levels: number[], values: number[]): PayPosition[] {
  return levels.map((level, i) => ({ position: i + 1, level, gross: values[i] }));
}

export const CAREERS: Career[] = [
  {
    slug: "enfermeiro",
    label: "enfermeiro",
    careerName: "Carreira especial de enfermagem",
    regime: "35 horas semanais",
    profession: "Enfermagem",
    intro:
      "No SNS, os enfermeiros entram na 1.ª posição da categoria de enfermeiro e progridem por posições remuneratórias. As categorias de enfermeiro especialista e enfermeiro gestor têm tabelas próprias.",
    categories: [
      {
        name: "Enfermeiro",
        positions: positions(
          [19, 23, 27, 31, 34, 37, 40, 43, 46, 49, 52],
          [1657.04, 1867.57, 2082.84, 2299.69, 2462.31, 2624.97, 2790.67, 2961.89, 3134.97, 3308.07, 3481.16],
        ),
      },
      {
        name: "Enfermeiro especialista",
        positions: positions(
          [24, 28, 31, 34, 37, 40, 43, 46, 49, 52],
          [1920.2, 2137.05, 2299.69, 2462.31, 2624.97, 2790.67, 2961.89, 3134.97, 3308.07, 3481.16],
        ),
      },
      {
        name: "Enfermeiro gestor",
        positions: positions(
          [38, 42, 46, 50, 53, 56, 58],
          [2679.17, 2904.18, 3134.97, 3365.77, 3538.86, 3711.96, 3827.36],
        ),
      },
    ],
  },
  {
    slug: "medico",
    label: "médico",
    careerName: "Carreira médica",
    regime: "40 horas semanais",
    profession: "Medicina",
    intro:
      "Os médicos especialistas entram como assistentes; as categorias de assistente graduado e assistente graduado sénior exigem grau de consultor. Os médicos internos (formação especializada) têm tabela própria.",
    categories: [
      {
        name: "Médico interno — formação geral",
        positions: positions([24], [1920.2]),
      },
      {
        name: "Médico interno — formação especializada (1.º ao 3.º ano)",
        positions: positions([30], [2245.48]),
      },
      {
        name: "Médico interno — formação especializada (4.º ano e seguintes)",
        positions: positions([35], [2516.53]),
      },
      {
        name: "Assistente",
        positions: positions(
          [53, 55, 57, 58, 59, 60],
          [3538.86, 3654.25, 3769.65, 3827.36, 3885.06, 3942.76],
        ),
      },
      {
        name: "Assistente graduado",
        positions: positions(
          [61, 63, 65, 67, 69, 71],
          [4000.45, 4115.88, 4231.26, 4346.65, 4462.07, 4577.45],
        ),
      },
      {
        name: "Assistente graduado sénior",
        positions: positions([76, 86, 96], [4865.94, 5442.93, 6019.92]),
      },
    ],
  },
  {
    slug: "tecnico-superior-de-diagnostico-e-terapeutica",
    label: "técnico superior de diagnóstico e terapêutica",
    careerName: "Carreira de técnico superior das áreas de diagnóstico e terapêutica",
    regime: "35 horas semanais",
    profession: "Técnico de Saúde",
    includes: [
      "fisioterapeuta",
      "técnico de radiologia",
      "técnico de análises clínicas",
      "cardiopneumologista",
      "terapeuta da fala",
      "terapeuta ocupacional",
      "técnico de farmácia",
      "dietista",
      "ortoptista",
    ],
    intro:
      "Fisioterapeutas, técnicos de radiologia, análises clínicas, cardiopneumologia, terapeutas da fala e ocupacionais, técnicos de farmácia e outras profissões de diagnóstico e terapêutica partilham esta carreira no SNS.",
    categories: [
      {
        name: "Técnico superior de diagnóstico e terapêutica",
        positions: positions(
          [15, 19, 23, 27, 30, 33, 36, 39],
          [1446.51, 1657.04, 1867.57, 2082.84, 2245.48, 2408.11, 2570.73, 2734.36],
        ),
      },
      {
        name: "Técnico superior de diagnóstico e terapêutica especialista",
        positions: positions([33, 36, 38, 40, 41], [2408.11, 2570.73, 2679.17, 2790.67, 2847.25]),
      },
      {
        name: "Técnico superior de diagnóstico e terapêutica especialista principal",
        positions: positions([38, 42, 47, 52, 57], [2679.17, 2904.18, 3192.67, 3481.16, 3769.65]),
      },
    ],
  },
  {
    slug: "tecnico-auxiliar-de-saude",
    label: "técnico auxiliar de saúde",
    careerName: "Carreira de técnico auxiliar de saúde",
    regime: "35 horas semanais",
    profession: "Auxiliares",
    intro:
      "Os técnicos auxiliares de saúde (antigos auxiliares de ação médica) têm carreira própria no SNS desde 2023, com as categorias de técnico auxiliar de saúde e técnico auxiliar de saúde principal.",
    categories: [
      {
        name: "Técnico auxiliar de saúde",
        positions: positions(
          [6, 7, 8, 9, 10, 11, 12, 13],
          [983.0, 1035.63, 1074.56, 1130.72, 1183.35, 1236.0, 1288.62, 1341.25],
        ),
      },
      {
        name: "Técnico auxiliar de saúde principal",
        positions: positions([13, 14, 15, 16], [1341.25, 1393.88, 1446.51, 1499.15]),
      },
    ],
  },
  {
    slug: "farmaceutico",
    label: "farmacêutico",
    careerName: "Carreira farmacêutica",
    regime: "35 horas semanais",
    profession: "Farmácia",
    intro:
      "No SNS, os farmacêuticos hospitalares entram como farmacêuticos assistentes, depois de concluída a residência farmacêutica, e progridem para assessor e assessor sénior.",
    categories: [
      {
        name: "Farmacêutico residente (1.º e 2.º anos)",
        positions: positions([18], [1604.41]),
      },
      {
        name: "Farmacêutico residente (3.º e 4.º anos)",
        positions: positions([20], [1709.68]),
      },
      {
        name: "Farmacêutico assistente",
        positions: positions(
          [27, 29, 31, 33, 35, 37, 39],
          [2082.84, 2191.27, 2299.69, 2408.11, 2516.53, 2624.97, 2734.36],
        ),
      },
      {
        name: "Farmacêutico assessor",
        positions: positions([38, 41, 43, 45, 47, 49], [2679.17, 2847.25, 2961.89, 3077.29, 3192.67, 3308.07]),
      },
      {
        name: "Farmacêutico assessor sénior",
        positions: positions([47, 49, 54, 59, 64], [3192.67, 3308.07, 3596.57, 3885.06, 4173.55]),
      },
    ],
  },
];

export function careerFromSlug(slug: string) {
  return CAREERS.find((career) => career.slug === slug) ?? null;
}

export function careerForProfession(profession: string | null) {
  if (!profession) return null;
  if (profession === "Fisioterapia") return careerFromSlug("tecnico-superior-de-diagnostico-e-terapeutica");
  return CAREERS.find((career) => career.profession === profession) ?? null;
}

export function careerRange(career: Career) {
  const all = career.categories.flatMap((c) => c.positions.map((p) => p.gross));
  return { min: Math.min(...all), max: Math.max(...all) };
}

/** 1.ª posição da categoria de entrada (não conta internatos/residências). */
export function careerEntry(career: Career) {
  const entry =
    career.categories.find((c) => !/interno|residente/i.test(c.name)) ?? career.categories[0];
  return { category: entry.name, gross: entry.positions[0].gross };
}

// ---------------------------------------------------------------------------
// IRS (retenção na fonte, continente) + Segurança Social

export type HouseholdType = "single" | "single_dependents" | "married_two" | "married_one";

type Bracket = {
  upTo: number;
  rate: number;
  /** Parcela a abater fixa, ou fórmula especial dos primeiros escalões. */
  deduction: number | { k: number; c: number };
};

/** Tabelas I e II (mesmos escalões; muda a parcela por dependente). */
const TABLE_I_II: Bracket[] = [
  { upTo: 920, rate: 0, deduction: 0 },
  { upTo: 1042, rate: 0.125, deduction: { k: 2.6, c: 1273.85 } },
  { upTo: 1108, rate: 0.157, deduction: { k: 1.35, c: 1554.83 } },
  { upTo: 1154, rate: 0.157, deduction: 94.71 },
  { upTo: 1212, rate: 0.212, deduction: 158.18 },
  { upTo: 1819, rate: 0.241, deduction: 193.33 },
  { upTo: 2119, rate: 0.311, deduction: 320.66 },
  { upTo: 2499, rate: 0.349, deduction: 401.19 },
  { upTo: 3305, rate: 0.3836, deduction: 487.66 },
  { upTo: 5547, rate: 0.3969, deduction: 531.62 },
  { upTo: 20221, rate: 0.4495, deduction: 823.4 },
  { upTo: Infinity, rate: 0.4717, deduction: 1272.31 },
];

/** Tabela III — casado, único titular. */
const TABLE_III: Bracket[] = [
  { upTo: 991, rate: 0, deduction: 0 },
  { upTo: 1042, rate: 0.125, deduction: { k: 2.6, c: 1372.15 } },
  { upTo: 1108, rate: 0.125, deduction: { k: 1.35, c: 1677.85 } },
  { upTo: 1119, rate: 0.125, deduction: 96.17 },
  { upTo: 1432, rate: 0.1272, deduction: 98.64 },
  { upTo: 1962, rate: 0.157, deduction: 141.32 },
  { upTo: 2240, rate: 0.1938, deduction: 213.53 },
  { upTo: 2773, rate: 0.2277, deduction: 289.47 },
  { upTo: 3389, rate: 0.257, deduction: 370.72 },
  { upTo: 5965, rate: 0.2881, deduction: 476.12 },
  { upTo: 20265, rate: 0.3843, deduction: 1049.96 },
  { upTo: Infinity, rate: 0.4717, deduction: 2821.13 },
];

const PER_DEPENDENT: Record<HouseholdType, number> = {
  single: 0,
  single_dependents: 34.29,
  married_two: 21.43,
  married_one: 42.86,
};

export const SOCIAL_SECURITY_RATE = 0.11;

export function irsWithholding(gross: number, household: HouseholdType = "single", dependents = 0) {
  const table = household === "married_one" ? TABLE_III : TABLE_I_II;
  const bracket = table.find((b) => gross <= b.upTo) ?? table[table.length - 1];
  if (bracket.rate === 0) return 0;
  const deduction =
    typeof bracket.deduction === "number"
      ? bracket.deduction
      : bracket.rate * bracket.deduction.k * (bracket.deduction.c - gross);
  const deps = household === "single" ? 0 : dependents;
  const value = gross * bracket.rate - deduction - PER_DEPENDENT[household] * deps;
  return Math.max(0, Math.round(value * 100) / 100);
}

/** Líquido mensal estimado: bruto − 11% (SS/CGA) − retenção de IRS. */
export function netMonthly(gross: number, household: HouseholdType = "single", dependents = 0) {
  const socialSecurity = Math.round(gross * SOCIAL_SECURITY_RATE * 100) / 100;
  const irs = irsWithholding(gross, household, dependents);
  return { gross, socialSecurity, irs, net: Math.round((gross - socialSecurity - irs) * 100) / 100 };
}

export function formatEur(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
