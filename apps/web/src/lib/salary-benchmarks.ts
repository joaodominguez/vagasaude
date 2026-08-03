/**
 * Referências indicativas de vencimento médio bruto mensal em Portugal
 * para funções de saúde. Baseado em tabelas públicas (TRU / carreiras SNS)
 * e intervalos de mercado privado/IPSS (2025–2026).
 *
 * Não substitui a remuneração anunciada na vaga.
 */

export type SalaryBenchmark = {
  /** Rótulo da função usada na estimativa (pode ser mais específico que a categoria). */
  label: string;
  /** Média / ponto médio (€ bruto / mês). */
  average: number;
  /** Intervalo inferior típico. */
  low: number;
  /** Intervalo superior típico (sem chefias / privados de topo). */
  high: number;
  source: string;
};

type BenchmarkRule = {
  needles: string[];
  label: string;
  average: number;
  low: number;
  high: number;
};

function norm(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Médias por categoria (fallback). */
const BY_PROFESSION: Record<
  string,
  Omit<SalaryBenchmark, "label" | "source"> & { label?: string }
> = {
  Enfermagem: { average: 1750, low: 1550, high: 2200 },
  Medicina: { average: 4200, low: 2800, high: 6500 },
  Fisioterapia: { average: 1550, low: 1350, high: 1900 },
  Auxiliares: { average: 1050, low: 920, high: 1250 },
  "Técnico de Saúde": { average: 1550, low: 1400, high: 1900 },
  Farmácia: { average: 1950, low: 1600, high: 2500 },
  Psicologia: { average: 1600, low: 1400, high: 2100 },
  Nutrição: { average: 1500, low: 1350, high: 1850 },
  "Assistência Social": { average: 1450, low: 1300, high: 1750 },
  Formação: { average: 1600, low: 1300, high: 2200 },
  "Comercial / Farma": { average: 2200, low: 1600, high: 3500 },
  "Gestão & suporte": { average: 1800, low: 1400, high: 2800 },
  Administrativo: { average: 1150, low: 950, high: 1450 },
  Outros: { average: 1400, low: 1000, high: 2000 },
};

/**
 * Regras por palavras no título — mais específicas primeiro.
 * Valores: bruto mensal típico em Portugal (saúde).
 */
const TITLE_RULES: BenchmarkRule[] = [
  // Enfermagem antes de regras médicas genéricas (ex.: "enfermeiro especialista").
  {
    needles: [
      "cuidados intensivos",
      "urgencia",
      "bloco operatorio",
      "atendimento permanente",
    ],
    label: "Enfermagem (UCI / urgência / bloco)",
    average: 1900,
    low: 1650,
    high: 2400,
  },
  {
    needles: ["enfermeiro", "enfermeira", "enfermagem"],
    label: "Enfermagem",
    average: 1750,
    low: 1550,
    high: 2200,
  },
  // Auxiliares / admin (antes de "medicina dentária" médica)
  {
    needles: ["assistente de medicina dent", "assistente dent"],
    label: "Assistente de medicina dentária",
    average: 1100,
    low: 950,
    high: 1400,
  },
  {
    needles: ["auxiliar de acao medica", "auxiliar de accao medica", "acao medica"],
    label: "Auxiliar de ação médica",
    average: 1050,
    low: 920,
    high: 1250,
  },
  {
    needles: ["assistente operacional"],
    label: "Assistente operacional",
    average: 980,
    low: 920,
    high: 1150,
  },
  {
    needles: ["rececion", "recepcion"],
    label: "Rececionista",
    average: 1100,
    low: 950,
    high: 1350,
  },
  // Medicina
  {
    needles: ["dentista", "medicina dentar", "medico dentista"],
    label: "Médico dentista",
    average: 3500,
    low: 2200,
    high: 5500,
  },
  {
    needles: ["medicina geral", "mgf", "clinica geral"],
    label: "Medicina Geral e Familiar",
    average: 4500,
    low: 3200,
    high: 6500,
  },
  {
    needles: ["internato", "interno de formacao", "medico interno"],
    label: "Internato médico",
    average: 2200,
    low: 1800,
    high: 2800,
  },
  {
    needles: [
      "assistente graduado",
      "assistente hospitalar",
      "medico especialista",
      "medica especialista",
    ],
    label: "Médico especialista (hospitalar)",
    average: 4800,
    low: 3500,
    high: 7000,
  },
  {
    needles: ["cirurgi"],
    label: "Médico cirurgião",
    average: 5500,
    low: 4000,
    high: 8000,
  },
  // Técnicos / terapias
  {
    needles: ["fisioterapeut"],
    label: "Fisioterapia",
    average: 1550,
    low: 1350,
    high: 1900,
  },
  {
    needles: ["cardiopneumolog", "neurofisiolog"],
    label: "Técnico de cardiopneumologia / neurofisiologia",
    average: 1600,
    low: 1450,
    high: 1950,
  },
  {
    needles: ["radiolog", "imagiolog"],
    label: "Técnico de radiologia",
    average: 1550,
    low: 1400,
    high: 1900,
  },
  {
    needles: ["terapeuta da fala", "terapeuta ocupacional"],
    label: "Terapeuta",
    average: 1500,
    low: 1350,
    high: 1850,
  },
  {
    needles: [
      "diagnostico e terapeut",
      "tecnico superior de saude",
      "tecnico auxiliar de saude",
    ],
    label: "Técnico de diagnóstico e terapêutica",
    average: 1550,
    low: 1400,
    high: 1900,
  },
  {
    needles: ["farmaceut", "farmacia"],
    label: "Farmácia",
    average: 1950,
    low: 1600,
    high: 2500,
  },
  {
    needles: ["psicolog"],
    label: "Psicologia",
    average: 1600,
    low: 1400,
    high: 2100,
  },
  {
    needles: ["nutric", "dietista"],
    label: "Nutrição",
    average: 1500,
    low: 1350,
    high: 1850,
  },
  {
    needles: ["administrador hospitalar"],
    label: "Administrador hospitalar",
    average: 2800,
    low: 2200,
    high: 3800,
  },
];

const SOURCE =
  "Estimativa indicativa (tabelas públicas TRU/SNS e referências de mercado 2025–2026). Não é o salário desta vaga.";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatEuroRange(low: number, high: number) {
  return `${formatEuro(low)} – ${formatEuro(high)}`;
}

/** Ajuste leve por setor (público tende a tabelas; privado mais disperso). */
function applySector(
  base: Omit<SalaryBenchmark, "source">,
  sector?: string | null,
): Omit<SalaryBenchmark, "source"> {
  const key = (sector || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (key.includes("publico") || key === "público" || key === "publico") {
    return {
      ...base,
      average: Math.round(base.average * 0.97),
      high: Math.round(base.high * 0.95),
    };
  }
  if (key.includes("privado")) {
    return {
      ...base,
      average: Math.round(base.average * 1.03),
      high: Math.round(base.high * 1.08),
    };
  }
  return base;
}

export function getSalaryBenchmark(
  profession: string,
  title?: string | null,
  sector?: string | null,
): SalaryBenchmark {
  const blob = norm(`${title || ""} ${profession || ""}`);

  for (const rule of TITLE_RULES) {
    if (rule.needles.some((needle) => blob.includes(norm(needle)))) {
      const adjusted = applySector(
        {
          label: rule.label,
          average: rule.average,
          low: rule.low,
          high: rule.high,
        },
        sector,
      );
      return { ...adjusted, source: SOURCE };
    }
  }

  const fallback = BY_PROFESSION[profession] || BY_PROFESSION.Outros;
  const adjusted = applySector(
    {
      label: fallback.label || profession || "Função de saúde",
      average: fallback.average,
      low: fallback.low,
      high: fallback.high,
    },
    sector,
  );
  return { ...adjusted, source: SOURCE };
}
