/**
 * Referencias indicativas de retribución bruta mensual en España para
 * profesiones sanitarias.
 *
 * TODO(ES): SIN DATOS TODAVÍA. El mecanismo (reglas por título, fallback por
 * profesión, ajuste por sector) se conserva de la versión portuguesa, pero los
 * importes deben salir de fuentes españolas verificables antes de mostrarse:
 *  - Retribuciones públicas por categoría: tablas de cada Servicio de Salud
 *    (BOE/BOJA/BOCM… "retribuciones personal estatutario") y convenios.
 *  - Mercado privado: convenio sanitario privado (p. ej. convenio de
 *    hospitalización privada) y estudios salariales con licencia clara.
 * Mientras `BY_PROFESSION` y `TITLE_RULES` estén vacíos, `getSalaryBenchmark`
 * devuelve null y la UI solo muestra la retribución anunciada en la oferta.
 *
 * No sustituye la retribución anunciada en la oferta.
 */

export type SalaryBenchmark = {
  /** Etiqueta de la función usada en la estimación (puede ser más específica que la categoría). */
  label: string;
  /** Media / punto medio (€ bruto / mes). */
  average: number;
  /** Intervalo inferior típico. */
  low: number;
  /** Intervalo superior típico (sin jefaturas / privados de primer nivel). */
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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Medias por categoría (fallback). TODO(ES): rellenar con datos verificados. */
const BY_PROFESSION: Record<
  string,
  Omit<SalaryBenchmark, "label" | "source"> & { label?: string }
> = {
  // Ejemplo de forma (NO usar estos valores):
  // Enfermería: { average: 0, low: 0, high: 0 },
};

/**
 * Reglas por palabras del título — las más específicas primero.
 * TODO(ES): rellenar con datos verificados (bruto mensual típico en España).
 */
const TITLE_RULES: BenchmarkRule[] = [];

const SOURCE =
  "Estimación indicativa (referencias públicas y de mercado). No es el salario de esta oferta.";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatEuroRange(low: number, high: number) {
  return `${formatEuro(low)} – ${formatEuro(high)}`;
}

/** Ajuste leve por sector (el público tiende a tablas; el privado más disperso). */
function applySector(
  base: Omit<SalaryBenchmark, "source">,
  sector?: string | null,
): Omit<SalaryBenchmark, "source"> {
  const key = (sector || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (key.includes("publico")) {
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

/** null mientras no haya datos para esa función (ver TODO al inicio del archivo). */
export function getSalaryBenchmark(
  profession: string,
  title?: string | null,
  sector?: string | null,
): SalaryBenchmark | null {
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

  const fallback = BY_PROFESSION[profession];
  if (!fallback) return null;
  const adjusted = applySector(
    {
      label: fallback.label || profession || "Función sanitaria",
      average: fallback.average,
      low: fallback.low,
      high: fallback.high,
    },
    sector,
  );
  return { ...adjusted, source: SOURCE };
}
