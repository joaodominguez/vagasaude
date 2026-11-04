/**
 * Tabelas oficiais de referência (pisos, concursos EBSERH, salário mínimo) e cálculo do
 * salário líquido CLT 2026. Só entram valores de fontes primárias, com URL e ano por linha.
 *
 * Fontes do cálculo:
 * - INSS (empregado): Portaria Interministerial MPS/MF nº 13, de 9/1/2026, Anexo II
 *   (alíquotas progressivas 7,5% / 9% / 12% / 14%; teto do salário de contribuição R$ 8.475,55).
 * - IRRF mensal 2026: tabela da Lei 15.191/2025, dedução por dependente R$ 189,59,
 *   desconto simplificado R$ 607,20 (Receita Federal) e redução da Lei 15.270/2025.
 */

export const SALARY_YEAR = 2026;
export const MINIMUM_WAGE_2026 = 1621;

export type OfficialSource = { label: string; url: string };

export const SOURCES = {
  lei14434: {
    label: "Lei 14.434/2022 (piso salarial da enfermagem)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14434.htm",
  },
  stf: {
    label: "STF — ADI 7.222, decisão do Plenário sobre o piso (3/7/2023)",
    url: "https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=509985&ori=1",
  },
  ebserhAssistencial: {
    label: "Ebserh — Edital nº 03/2024 (Área Assistencial), retificado em 13/02/2025, Anexo III",
    url: "https://www.gov.br/hubrasil/pt-br/acesso-a-informacao/agentes-publicos/concursos-e-selecoes/concursos/2024/editais/edital-no-03-2013-ebserh_nacional-2013-area-assistencial-retificado-em-13-02-2025.pdf",
  },
  ebserhMedica: {
    label: "Ebserh — Edital nº 02/2026 (Área Médica), de 5/1/2026, Anexo III",
    url: "https://www.gov.br/hubrasil/pt-br/acesso-a-informacao/agentes-publicos/concursos-e-selecoes/concursos/2026/editais/edital-no-2-ebserh-nacional-area-medica.pdf",
  },
  salarioMinimo: {
    label: "Decreto nº 12.797/2025 (salário mínimo 2026)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm",
  },
  inss: {
    label: "Portaria Interministerial MPS/MF nº 13/2026 (tabela do INSS)",
    url: "https://www.legisweb.com.br/legislacao/?id=489284",
  },
  receita: {
    label: "Receita Federal — Tabelas do IRPF 2026",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
  },
  lei15270: {
    label: "Lei 15.270/2025 (redução do IRRF até R$ 7.350)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15270.htm",
  },
} satisfies Record<string, OfficialSource>;

export type OfficialRow = {
  /** Cargo / situação. */
  name: string;
  /** Jornada semanal a que o valor se refere. */
  workload: string;
  /** Valor mensal bruto (R$). */
  value: number;
  source: OfficialSource;
  year: number;
};

export type OfficialTable = {
  title: string;
  note?: string;
  rows: OfficialRow[];
};

const NURSING_FLOOR_ROWS: OfficialRow[] = [
  { name: "Enfermeiro", workload: "44 h", value: 4750, source: SOURCES.lei14434, year: 2022 },
  { name: "Técnico de enfermagem (70% do piso do enfermeiro)", workload: "44 h", value: 3325, source: SOURCES.lei14434, year: 2022 },
  { name: "Auxiliar de enfermagem (50%)", workload: "44 h", value: 2375, source: SOURCES.lei14434, year: 2022 },
  { name: "Parteira (50%)", workload: "44 h", value: 2375, source: SOURCES.lei14434, year: 2022 },
];

const NURSING_NOTE =
  "O piso vale para jornada de 44 horas semanais; em jornadas menores, o STF decidiu que o valor é proporcional (8 h por dia, 44 h por semana). Pelo STF, no setor privado a implementação passa por negociação coletiva (sem acordo, aplica-se o piso legal) e estados e municípios pagam na medida dos repasses federais. Confira o acordo coletivo ou o regime do seu empregador.";

function ebserh(name: string, workload: string, value: number): OfficialRow {
  return { name, workload, value, source: SOURCES.ebserhAssistencial, year: 2024 };
}

const NURSING_FLOOR_TABLE: OfficialTable = {
  title: "Piso salarial nacional da enfermagem",
  note: NURSING_NOTE,
  rows: NURSING_FLOOR_ROWS,
};

const MIN_WAGE_ROW: OfficialRow = {
  name: "Salário mínimo nacional",
  workload: "44 h",
  value: MINIMUM_WAGE_2026,
  source: SOURCES.salarioMinimo,
  year: 2026,
};

/** Tabelas oficiais por slug de função do observatório. */
export const OFFICIAL_TABLES: Record<string, OfficialTable[]> = {
  enfermeiro: [
    NURSING_FLOOR_TABLE,
    {
      title: "Referência federal: Ebserh (hospitais universitários)",
      note: "Remuneração inicial prevista no edital do concurso nacional da Ebserh (Área Assistencial), o mais recente para cargos de enfermagem.",
      rows: [ebserh("Enfermeiro", "36 h", 8345.74)],
    },
  ],
  "tecnico-de-enfermagem": [
    NURSING_FLOOR_TABLE,
    {
      title: "Referência federal: Ebserh (hospitais universitários)",
      note: "Remuneração inicial prevista no edital do concurso nacional da Ebserh (Área Assistencial), o mais recente para cargos de enfermagem.",
      rows: [ebserh("Técnico em Enfermagem", "36 h", 4060.72)],
    },
  ],
  "auxiliar-de-enfermagem": [NURSING_FLOOR_TABLE],
  farmaceutico: [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Farmacêutico", "40 h", 7859.09)] },
  ],
  fisioterapeuta: [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Fisioterapeuta", "30 h", 5894.31)] },
  ],
  nutricionista: [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Nutricionista", "40 h", 7859.09)] },
  ],
  psicologo: [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Psicólogo", "40 h", 6659.97)] },
  ],
  "assistente-social": [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Assistente Social", "30 h", 5894.31)] },
  ],
  "tecnico-de-radiologia": [
    { title: "Referência federal: Ebserh (hospitais universitários)", rows: [ebserh("Técnico em Radiologia", "24 h", 2707.15)] },
  ],
};

export const MEDICO_EBSERH_ROWS: OfficialRow[] = [
  { name: "Médico (maioria das especialidades)", workload: "24 h", value: 11464.35, source: SOURCES.ebserhMedica, year: 2026 },
  { name: "Médico (clínico, 40 h)", workload: "40 h", value: 19107.31, source: SOURCES.ebserhMedica, year: 2026 },
];

export const MINIMUM_WAGE_ROW = MIN_WAGE_ROW;

/** Referência principal (para a tabela "Por carreira" do índice). */
export function careerReference(slug: string): { floor?: number; ebserh?: OfficialRow } {
  const tables = OFFICIAL_TABLES[slug] ?? [];
  const rows = tables.flatMap((t) => t.rows);
  const ebserhRow = rows.find((r) => r.source === SOURCES.ebserhAssistencial);
  const floorRow = rows.find((r) => r.source === SOURCES.lei14434);
  const floorByRole: Record<string, number> = {
    enfermeiro: 4750,
    "tecnico-de-enfermagem": 3325,
    "auxiliar-de-enfermagem": 2375,
  };
  return { floor: floorRow ? floorByRole[slug] : undefined, ebserh: ebserhRow };
}

export function formatBRL2(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/* ------------------------------------------------------------------ */
/* Salário líquido CLT 2026                                            */
/* ------------------------------------------------------------------ */

export const INSS_BRACKETS = [
  { upTo: 1621.0, rate: 0.075 },
  { upTo: 2902.84, rate: 0.09 },
  { upTo: 4354.27, rate: 0.12 },
  { upTo: 8475.55, rate: 0.14 },
] as const;
export const INSS_CEILING = 8475.55;

export const IRRF_BRACKETS = [
  { upTo: 2428.8, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 182.16 },
  { upTo: 3751.05, rate: 0.15, deduction: 394.16 },
  { upTo: 4664.68, rate: 0.225, deduction: 675.49 },
  { upTo: Infinity, rate: 0.275, deduction: 908.73 },
] as const;
export const IRRF_DEPENDENT_DEDUCTION = 189.59;
export const IRRF_SIMPLIFIED_DISCOUNT = 607.2;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** INSS do empregado (progressivo, limitado ao teto). */
export function inssEmployee(gross: number) {
  const base = Math.min(Math.max(gross, 0), INSS_CEILING);
  let total = 0;
  let previous = 0;
  for (const bracket of INSS_BRACKETS) {
    if (base > previous) total += (Math.min(base, bracket.upTo) - previous) * bracket.rate;
    previous = bracket.upTo;
  }
  return round2(total);
}

/** Imposto pela tabela progressiva mensal, antes da redução da Lei 15.270. */
export function irrfTable(base: number) {
  if (base <= 0) return 0;
  const bracket = IRRF_BRACKETS.find((b) => base <= b.upTo)!;
  return round2(Math.max(0, base * bracket.rate - bracket.deduction));
}

/** Redução mensal da Lei 15.270/2025 sobre o rendimento tributável bruto. */
export function irrfReduction(taxable: number, tax: number) {
  if (taxable <= 5000) return Math.min(312.89, tax);
  if (taxable <= 7350) return Math.min(tax, Math.max(0, round2(978.62 - 0.133145 * taxable)));
  return 0;
}

export type NetResult = {
  gross: number;
  inss: number;
  /** Dedução usada na base do IRRF. */
  deduction: number;
  deductionKind: "legal" | "simplificado";
  base: number;
  irrfBeforeReduction: number;
  reduction: number;
  irrf: number;
  otherDiscounts: number;
  net: number;
  effectiveRate: number;
};

/**
 * Líquido mensal estimado de um empregado CLT. Usa o desconto simplificado quando
 * ele supera INSS + dependentes (como na tabela da Receita Federal).
 */
export function netSalary(gross: number, dependents = 0, otherDiscounts = 0): NetResult {
  const inss = inssEmployee(gross);
  const legal = inss + dependents * IRRF_DEPENDENT_DEDUCTION;
  const simplified = legal < IRRF_SIMPLIFIED_DISCOUNT;
  const deduction = simplified ? IRRF_SIMPLIFIED_DISCOUNT : legal;
  const base = Math.max(0, round2(gross - deduction));
  const irrfBeforeReduction = irrfTable(base);
  const reduction = round2(irrfReduction(gross, irrfBeforeReduction));
  const irrf = round2(Math.max(0, irrfBeforeReduction - reduction));
  const net = round2(gross - inss - irrf - otherDiscounts);
  return {
    gross,
    inss,
    deduction: round2(deduction),
    deductionKind: simplified ? "simplificado" : "legal",
    base,
    irrfBeforeReduction,
    reduction,
    irrf,
    otherDiscounts,
    net,
    effectiveRate: gross > 0 ? (inss + irrf) / gross : 0,
  };
}
