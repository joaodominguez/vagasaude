/**
 * Referencias indicativas de retribución bruta en España para profesiones
 * sanitarias (cifras 2025-2026, solo fuentes oficiales primarias).
 *
 * CONVENCIÓN ÚNICA DE IMPORTES (importante)
 * Todos los importes son € brutos / mes = retribución bruta ANUAL ÷ 12, es
 * decir, con las pagas extraordinarias prorrateadas. No son la nómina de un
 * mes concreto: en el sector público (y en los convenios de dependencia y
 * farmacia) se cobra en 14 pagas (12 + 2 extras), así que cada mensualidad
 * real es menor y las dos pagas extra son mayores. Convertimos todo a "anual
 * ÷ 12" para que sea comparable entre fuentes.
 *  - Tablas del sector público: columna "Total año" (14 pagas) ÷ 12.
 *  - Convenios: salario base mensual (14 pagas) × 14 ÷ 12.
 * No incluyen trienios/antigüedad, carrera profesional, guardias, turnicidad
 * ni nocturnidad (salvo que el complemento específico/productividad fija de
 * la tabla ya los recoja como fijos).
 *
 * FUENTES (consultadas en origen)
 * - INGESA 2026 (v4, 5-ene-2026, +1,5 % RDL 14/2025): Ministerio de Sanidad,
 *   "Retribuciones año 2026, personal de instituciones sanitarias", Tabla I.
 *   https://ingesa.sanidad.gob.es/dam/jcr:ed0c64ae-7c62-480a-ab95-790e35bb4411/CUADERNO%20RETRIBUCIONES%202026.pdf
 * - IB-Salut 2026: "Tablas retributivas 2026", Tabla I (1-1-2026). Servicio
 *   de Salud con retribuciones fijas altas; hace de techo del rango.
 *   https://ibsalut.es/docs/rrhh/normativa/instrucciones%20y%20circulares/es/Tablas%20retributivas_2026_ESP.pdf
 * - Ministerio de Sanidad, "Situación del personal técnico en cuidados
 *   auxiliares de enfermería en España" (2025, publicado jul-2026), tabla 9
 *   (retribuciones fijas del PTCAE por comunidad, tablas 2024-2025):
 *   https://www.sanidad.gob.es/areas/cuidadosEnSalud/investigacionDatos/docs/2026_07_20_informe_TCAES_final.pdf
 *   Mínimo = Cantabria (1.404,92 €/mes en 12 pagas + 2 extras estimadas como
 *   sueldo base + complemento de destino) ≈ 19.023 €/año.
 * - VIII Convenio marco estatal de servicios de atención a las personas
 *   dependientes (residencias), BOE-A-2023-13742, Anexo I, tabla 2025
 *   (sueldo base mensual; 2 pagas extra = 1 mensualidad cada una, art. de
 *   gratificaciones extraordinarias). Convenio en ultraactividad en 2026.
 *   https://www.boe.es/boe/dias/2023/06/09/pdfs/BOE-A-2023-13742.pdf
 * - XXV Convenio colectivo estatal de oficinas de farmacia: acuerdo de
 *   cuantificación provisional 2025 y 2026 (a cuenta, +2 % anual), BOE-A-2026-4220
 *   (BOE 23-feb-2026), salario base mensual en 14 pagas, tabla 2026.
 *   https://www.boe.es/boe/dias/2026/02/23/pdfs/BOE-A-2026-4220.pdf
 *
 * LIMITACIONES CONOCIDAS
 * - El rango público es el de los dos servicios de salud con tabla verificada
 *   (INGESA y IB-Salut); otras comunidades pueden quedar fuera (p. ej. País
 *   Vasco o Cantabria más bajos, Navarra más alto). TCAE sí tiene mínimo
 *   autonómico del informe del Ministerio.
 * - Las cifras de convenio (dependencia, farmacia) son SUELDO BASE MÍNIMO de
 *   convenio: el salario real suele ser mayor (antigüedad, pluses, mejoras).
 * - No hay convenio estatal de sanidad privada hospitalaria; los provinciales
 *   (p. ej. Madrid 2023-2026, BOCM 23-nov-2023) no se usan porque el Anexo IV
 *   separa "SB" y "complementos" sin que el texto aclare la periodicidad.
 *   En sector privado/concertado se muestra la referencia pública y se avisa.
 * - Roles SIN referencia (devuelven null, no se inventan): MIR/EIR/residentes,
 *   TES (emergencias sanitarias), auxiliar de clínica dental, odontología,
 *   psicología, nutrición, veterinaria, formación, comercial/farma, gestión y
 *   apoyo, administrativo (sin fuente específica sanitaria verificada).
 *
 * No sustituye la retribución anunciada en la oferta.
 */

export type SalaryBenchmark = {
  /** Etiqueta de la función usada en la estimación (puede ser más específica que la categoría). */
  label: string;
  /** Punto medio entre `low` y `high` (€ bruto / mes, anual ÷ 12). */
  average: number;
  /** Intervalo inferior (€ bruto / mes, anual ÷ 12). */
  low: number;
  /** Intervalo superior (€ bruto / mes, anual ÷ 12). */
  high: number;
  /** "range" = rango entre tablas públicas; "floor" = sueldo base mínimo de convenio (low = average = high). */
  kind: "range" | "floor";
  source: string;
};

type Basis = "publico" | "convenio";

type Figures = {
  label: string;
  /** Si no se indica, punto medio entre low y high. */
  average?: number;
  basis: Basis;
  kind: "range" | "floor";
  low: number;
  high: number;
  source: string;
};

type BenchmarkRule = {
  /** Se prueba contra el texto normalizado (título + profesión). `null` = sin referencia fiable. */
  test: RegExp;
  /** Si se indica, la regla solo aplica a estas profesiones. */
  professions?: string[];
  figures: Figures | null;
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

/** Total anual bruto → € bruto / mes (pagas extra prorrateadas). */
const fromAnnual = (annual: number) => Math.round(annual / 12);
/** Salario base mensual en 14 pagas → € bruto / mes (anual ÷ 12). */
const fromBase14 = (base: number) => Math.round((base * 14) / 12);

const SRC_PUBLIC =
  "Tablas retributivas 2026 de INGESA (Ministerio de Sanidad) e IB-Salut, personal estatutario: total anual ÷ 12 (pagas extra prorrateadas), sin trienios, carrera, guardias ni turnicidad.";
const SRC_TCAE =
  "Informe del Ministerio de Sanidad sobre TCAE (2025) y tablas 2026 de INGESA e IB-Salut, personal estatutario: total anual ÷ 12, sin trienios, guardias ni turnicidad.";
const SRC_DEP =
  "Sueldo base mínimo 2025 del VIII Convenio marco estatal de dependencia (BOE-A-2023-13742), 14 pagas × 14 ÷ 12; sin antigüedad ni pluses.";
const SRC_FARM =
  "Sueldo base mínimo 2026 (provisional, a cuenta) del XXV Convenio estatal de oficinas de farmacia (BOE-A-2026-4220), 14 pagas × 14 ÷ 12; sin antigüedad ni pluses.";

function publicRange(
  label: string,
  lowAnnual: number,
  highAnnual: number,
  source = SRC_PUBLIC,
  averageAnnual?: number,
): Figures {
  return {
    label,
    average: averageAnnual === undefined ? undefined : fromAnnual(averageAnnual),
    basis: "publico",
    kind: "range",
    low: fromAnnual(lowAnnual),
    high: fromAnnual(highAnnual),
    source,
  };
}

function floor(label: string, base14: number, source: string): Figures {
  const v = fromBase14(base14);
  return { label, basis: "convenio", kind: "floor", low: v, high: v, source };
}

// --- Figuras (importes anuales/base tal y como figuran en las fuentes) ------

const ENFERMERIA = publicRange(
  "Enfermería (hospital, sector público)",
  31666.39, // INGESA 2026: Enfermera/DUE en unidades de hospitalización, UCI, urgencias
  34603.1, // IB-Salut 2026: Enfermero/enfermera (hospital)
);
const MATRONA = publicRange(
  "Matrona / enfermería obstétrico-ginecológica",
  32431.58, // INGESA 2026: Matrona (atención especializada)
  36504.92, // IB-Salut 2026: Enfermero obstétrico-ginecológico
);
const FISIO = publicRange(
  "Fisioterapia (sector público)",
  31954.27, // INGESA 2026: Fisioterapeuta
  34603.1, // IB-Salut 2026: Fisioterapeuta
);
const FEA = publicRange(
  "Facultativo especialista de área (FEA)",
  53917.9, // INGESA 2026: Adjunto/FEA
  54413.14, // IB-Salut 2026: Adjunto/FEA
);
const MEDICO_FAMILIA = publicRange(
  "Médico de familia / atención primaria",
  47625.1, // IB-Salut 2026: Médico general de EAP
  52462.66, // INGESA 2026: Médico de ESAD (INGESA fija el médico de EAP por tarjetas, variable)
);
const MEDICINA = publicRange(
  "Medicina (sector público, sin guardias)",
  47625.1, // IB-Salut 2026: Médico general de EAP
  54413.14, // IB-Salut 2026: Adjunto/FEA
);
const TCAE = publicRange(
  "TCAE (sector público)",
  19022.56, // Informe Sanidad TCAE: Cantabria (mínimo autonómico), estimado a anual
  24049.0, // IB-Salut 2026: TCAE
  SRC_TCAE,
  21656.95, // media = INGESA 2026: Auxiliar de enfermería en unidades de hospitalización
);
const TECNICO_SUPERIOR = publicRange(
  "Técnico superior sanitario (imagen, laboratorio…)",
  24447.87, // INGESA 2026: Técnico superior (atención especializada)
  27983.84, // IB-Salut 2026: Técnico especialista
);
const CELADOR = publicRange(
  "Celador/a (sector público)",
  20497.08, // INGESA 2026: Celador con atención directa al enfermo (atención primaria)
  23170.26, // IB-Salut 2026: Celador/celadora
);
const TRABAJO_SOCIAL = publicRange(
  "Trabajo social (sector público)",
  31425.49, // INGESA 2026: Trabajador social
  34602.86, // IB-Salut 2026: Trabajador/a social
);
const FARMACIA_HOSPITAL = publicRange(
  "Farmacéutico/a (sector público)",
  48691.18, // INGESA 2026: Farmacéutico
  50812.18, // IB-Salut 2026: Farmacéutico de atención primaria
);

const GEROCULTOR = floor("Gerocultor/a / TCAE en residencia (mínimo de convenio)", 1160.37, SRC_DEP);
const DEP_ENFERMERIA = floor("Enfermería en residencia (mínimo de convenio)", 1567.96, SRC_DEP);
const DEP_FISIO = floor("Fisioterapia en residencia (mínimo de convenio)", 1455.98, SRC_DEP);
const DEP_SOCIAL = floor("Trabajo social en residencia (mínimo de convenio)", 1455.98, SRC_DEP);
const DEP_MEDICO = floor("Medicina en residencia (mínimo de convenio)", 1791.96, SRC_DEP);
const FARM_OFICINA = floor("Farmacéutico/a de oficina de farmacia (mínimo de convenio)", 2223.37, SRC_FARM);
const TEC_FARMACIA = floor("Técnico/a de farmacia (mínimo de convenio)", 1507.27, SRC_FARM);

/** Fallback por categoría (cuando no hay regla específica por título). */
const BY_PROFESSION: Record<string, Figures> = {
  Enfermería: ENFERMERIA,
  Medicina: MEDICINA,
  TCAE: TCAE,
  Fisioterapia: FISIO,
  "Técnico sanitario": TECNICO_SUPERIOR,
  Farmacia: FARM_OFICINA,
  "Técnico de farmacia": TEC_FARMACIA,
  Celador: CELADOR,
  "Trabajo social": TRABAJO_SOCIAL,
};

const RESIDENCIA = /\b(residencia|residencias|geriatri\w*|dependencia|sociosanitari\w*|centro de mayores|centro de dia)\b/;
const HOSPITAL = /\b(hospital|hospitalari\w*|hospitalizacion)\b/;

/**
 * Reglas por palabras del título (texto normalizado: minúsculas, sin tildes).
 * Orden: exclusiones sin dato → residencias → roles específicos → genéricos.
 */
const TITLE_RULES: BenchmarkRule[] = [
  // --- Sin referencia fiable: devolver null (no caer en otra categoría) ---
  {
    test: /\b(mir|eir|fir|pir|bir|residente|medico interno|medico residente|enfermera interna residente)\b/,
    figures: null,
  },
  {
    test: /(auxiliar (de )?(clinica )?dental|auxiliar de odontolog|asistente dental|tecnico en emergencias|emergencias sanitarias|\btes\b|conductor de ambulancia|tecnico de transporte sanitario)/,
    figures: null,
  },

  // --- Residencias y dependencia (convenio marco estatal) ---
  {
    test: new RegExp(`(?=.*${RESIDENCIA.source})(?=.*(enfermer|\\bdue\\b|\\bats\\b))`),
    figures: DEP_ENFERMERIA,
  },
  {
    test: new RegExp(`(?=.*${RESIDENCIA.source})(?=.*fisioterap)`),
    figures: DEP_FISIO,
  },
  {
    test: new RegExp(`(?=.*${RESIDENCIA.source})(?=.*trabajo social|trabajador social|trabajadora social)`),
    figures: DEP_SOCIAL,
  },
  {
    test: new RegExp(`(?=.*${RESIDENCIA.source})(?=.*\\bmedic)`),
    figures: DEP_MEDICO,
  },
  {
    test: new RegExp(`(?=.*${RESIDENCIA.source})(?=.*(tcae|auxiliar de enfermeria|cuidados auxiliares|auxiliar de geriatria|gerocultor))`),
    figures: GEROCULTOR,
  },
  { test: /gerocultor/, figures: GEROCULTOR },

  // --- Farmacia ---
  {
    test: HOSPITAL,
    professions: ["Técnico de farmacia"],
    figures: { ...TCAE, label: "Técnico/a de farmacia hospitalaria (tablas del SNS)" },
  },
  {
    test: /./,
    professions: ["Técnico de farmacia"],
    figures: TEC_FARMACIA,
  },
  {
    test: HOSPITAL,
    professions: ["Farmacia"],
    figures: FARMACIA_HOSPITAL,
  },
  { test: /./, professions: ["Farmacia"], figures: FARM_OFICINA },

  // --- Medicina ---
  {
    test: /(medico de familia|medicina familiar|medicina de familia|medico general|medicina general|atencion primaria.*medic|medic.*atencion primaria)/,
    professions: ["Medicina"],
    figures: MEDICO_FAMILIA,
  },
  {
    test: /(facultativo especialista|\bfea\b|medico especialista|medico adjunto|adjunto)/,
    professions: ["Medicina"],
    figures: FEA,
  },

  // --- Enfermería ---
  {
    test: /(matrona|obstetric|ginecolog.*enfermer|enfermer.*obstetric)/,
    figures: MATRONA,
  },
  { test: /(enfermer|\bdue\b|\bats\b)/, professions: ["Enfermería"], figures: ENFERMERIA },

  // --- Técnicos y otros ---
  {
    test: /(higienista bucodental|higienista dental)/,
    figures: { ...TECNICO_SUPERIOR, label: "Higienista bucodental (tablas del SNS)" },
  },
  {
    test: /(imagen para el diagnostico|radiodiagnostico|laboratorio|anatomia patologica|tecnico superior|tecnico especialista|radioterapia|medicina nuclear|dietetica)/,
    professions: ["Técnico sanitario"],
    figures: TECNICO_SUPERIOR,
  },
  { test: /(fisioterap)/, professions: ["Fisioterapia"], figures: FISIO },
  { test: /(celador|camillero)/, professions: ["Celador"], figures: CELADOR },
  { test: /(tcae|auxiliar de enfermeria|cuidados auxiliares)/, professions: ["TCAE"], figures: TCAE },
];

const PRIVATE_NOTE =
  " En sector privado o concertado el salario real puede diferir de las tablas públicas.";
const DISCLAIMER = " No es el salario de esta oferta.";

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

function build(f: Figures, sector?: string | null): SalaryBenchmark {
  const key = norm(sector || "");
  const isPrivateLike = key.includes("privado") || key.includes("concertado");
  return {
    label: f.label,
    average: f.average ?? Math.round((f.low + f.high) / 2),
    low: f.low,
    high: f.high,
    kind: f.kind,
    source:
      f.source +
      (f.basis === "publico" && isPrivateLike ? PRIVATE_NOTE : "") +
      DISCLAIMER,
  };
}

/** null cuando no hay referencia verificada para esa función (ver cabecera del archivo). */
export function getSalaryBenchmark(
  profession: string,
  title?: string | null,
  sector?: string | null,
): SalaryBenchmark | null {
  const blob = norm(`${title || ""} ${profession || ""}`);

  for (const rule of TITLE_RULES) {
    if (rule.professions && !rule.professions.includes(profession)) continue;
    if (!rule.test.test(blob)) continue;
    return rule.figures ? build(rule.figures, sector) : null;
  }

  const fallback = BY_PROFESSION[profession];
  if (!fallback) return null;
  return build(fallback, sector);
}
