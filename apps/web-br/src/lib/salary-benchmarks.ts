/**
 * Referências indicativas de salário médio bruto mensal no Brasil
 * para funções de saúde. Baseado em pisos salariais, tabelas públicas
 * e intervalos de mercado privado/filantrópico (2025–2026).
 *
 * Não substitui a remuneração anunciada na vaga.
 */

export type SalaryBenchmark = {
  /** Rótulo da função usada na estimativa (pode ser mais específico que a categoria). */
  label: string;
  /** Média / ponto médio (R$ bruto / mês). */
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

/** Médias por categoria (fallback) — R$ bruto / mês. */
const BY_PROFESSION: Record<
  string,
  Omit<SalaryBenchmark, "label" | "source"> & { label?: string }
> = {
  Enfermagem: { average: 4500, low: 3500, high: 7000 },
  Medicina: { average: 12000, low: 8000, high: 25000 },
  Fisioterapia: { average: 4000, low: 3000, high: 6000 },
  Auxiliares: { average: 2500, low: 1800, high: 3500 },
  "Técnico de Saúde": { average: 3800, low: 2800, high: 5500 },
  Farmácia: { average: 5500, low: 4000, high: 9000 },
  Psicologia: { average: 4500, low: 3000, high: 8000 },
  Nutrição: { average: 4000, low: 3000, high: 6000 },
  "Assistência Social": { average: 3500, low: 2800, high: 5000 },
  Formação: { average: 4000, low: 3000, high: 7000 },
  "Comercial / Farma": { average: 6000, low: 4000, high: 12000 },
  "Gestão & suporte": { average: 5500, low: 3500, high: 10000 },
  Administrativo: { average: 2800, low: 2000, high: 4500 },
  Outros: { average: 3500, low: 2500, high: 6000 },
};

/**
 * Regras por palavras no título — mais específicas primeiro.
 * Valores: bruto mensal típico no Brasil (saúde), em R$.
 */
const TITLE_RULES: BenchmarkRule[] = [
  {
    needles: [
      "cuidados intensivos",
      "uti",
      "urgencia",
      "emergencia",
      "centro cirurgico",
      "bloco operatorio",
    ],
    label: "Enfermagem (UTI / urgência / centro cirúrgico)",
    average: 5200,
    low: 4000,
    high: 8000,
  },
  {
    needles: ["enfermeiro", "enfermeira", "enfermagem"],
    label: "Enfermagem",
    average: 4500,
    low: 3500,
    high: 7000,
  },
  {
    needles: ["tecnico de enfermagem", "técnica de enfermagem", "tec enfermagem"],
    label: "Técnico de enfermagem",
    average: 2800,
    low: 2000,
    high: 3800,
  },
  {
    needles: ["auxiliar de enfermagem", "auxiliar enfermagem"],
    label: "Auxiliar de enfermagem",
    average: 2200,
    low: 1600,
    high: 3000,
  },
  {
    needles: ["assistente de odontologia", "auxiliar de dentista", "assistente dent"],
    label: "Auxiliar / assistente de odontologia",
    average: 2400,
    low: 1800,
    high: 3500,
  },
  {
    needles: ["recepcion"],
    label: "Recepcionista",
    average: 2200,
    low: 1600,
    high: 3000,
  },
  {
    needles: ["dentista", "cirurgiao dentista", "cirurgião-dentista", "odonto"],
    label: "Cirurgião-dentista",
    average: 9000,
    low: 5000,
    high: 18000,
  },
  {
    needles: ["clinica geral", "medico clinico", "clínico geral", "ubs"],
    label: "Médico clínico geral",
    average: 11000,
    low: 7000,
    high: 18000,
  },
  {
    needles: ["residencia", "residente", "medico residente"],
    label: "Residência médica",
    average: 4500,
    low: 3500,
    high: 6000,
  },
  {
    needles: [
      "medico especialista",
      "medica especialista",
      "especialista hospitalar",
    ],
    label: "Médico especialista (hospitalar)",
    average: 15000,
    low: 10000,
    high: 28000,
  },
  {
    needles: ["cirurgi"],
    label: "Médico cirurgião",
    average: 18000,
    low: 12000,
    high: 35000,
  },
  {
    needles: ["fisioterapeut"],
    label: "Fisioterapia",
    average: 4000,
    low: 3000,
    high: 6000,
  },
  {
    needles: ["radiolog", "imagem", "tomograf", "ressonancia"],
    label: "Técnico em radiologia",
    average: 3800,
    low: 2800,
    high: 5500,
  },
  {
    needles: ["fonoaudiolog", "terapeuta ocupacional"],
    label: "Terapeuta",
    average: 3800,
    low: 2800,
    high: 5500,
  },
  {
    needles: [
      "tecnico em saude",
      "tecnico de saude",
      "tecnico laboratorial",
      "analises clinicas",
    ],
    label: "Técnico de saúde",
    average: 3800,
    low: 2800,
    high: 5500,
  },
  {
    needles: ["farmaceut", "farmacia"],
    label: "Farmácia",
    average: 5500,
    low: 4000,
    high: 9000,
  },
  {
    needles: ["psicolog"],
    label: "Psicologia",
    average: 4500,
    low: 3000,
    high: 8000,
  },
  {
    needles: ["nutric", "dietista"],
    label: "Nutrição",
    average: 4000,
    low: 3000,
    high: 6000,
  },
  {
    needles: ["administrador hospitalar", "gestor hospitalar"],
    label: "Administrador hospitalar",
    average: 9000,
    low: 6000,
    high: 15000,
  },
];

const SOURCE =
  "Estimativa indicativa (pisos salariais e referências de mercado Brasil 2025–2026). Não é o salário desta vaga.";

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBRLRange(low: number, high: number) {
  return `${formatBRL(low)} – ${formatBRL(high)}`;
}

/** @deprecated use formatBRL */
export const formatEuro = formatBRL;
/** @deprecated use formatBRLRange */
export const formatEuroRange = formatBRLRange;

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
