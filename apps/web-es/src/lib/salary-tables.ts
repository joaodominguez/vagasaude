/**
 * Tablas retributivas oficiales del personal sanitario en España y cálculo del
 * sueldo neto estimado.
 *
 * En España no hay una tabla única: cada Servicio de Salud fija sus propias
 * retribuciones (sueldo base y complemento de destino son estatales; el
 * complemento específico y la productividad fija los pone cada comunidad).
 * Solo se muestran filas verificadas en la fuente primaria (año y URL en cada
 * fila). Las comunidades sin tabla oficial verificada se omiten.
 *
 * FUENTES
 * - INGESA 2026 (Ceuta y Melilla), v4 de 5-ene-2026 (+1,5 % RDL 14/2025):
 *   Tabla I del cuaderno "Retribuciones año 2026".
 * - IB-Salut 2026 (Baleares): "Tablas retributivas 2026", Tabla I (1-1-2026).
 * - Ministerio de Sanidad, informe TCAE 2025 (publicado 20-jul-2026), tabla 9:
 *   retribuciones fijas mensuales por comunidad (tablas oficiales 2024-2025).
 * - VIII Convenio marco estatal de dependencia, BOE-A-2023-13742, tabla 2025.
 * - XXV Convenio estatal de oficinas de farmacia, BOE-A-2026-4220 (2026,
 *   provisional "a cuenta").
 * - Seguridad Social 2026: Orden PJC/297/2026 (BOE-A-2026-7296).
 * - IRPF 2026: AEAT, "Las retenciones e ingresos a cuenta del IRPF sobre los
 *   rendimientos del trabajo en el ejercicio 2026 (1 ene - 9 sep)": escala del
 *   art. 101.1 LIRPF (única para todo el territorio común: estatal +
 *   autonómica), cuadros 1, 2 y 5, mínimos personal y familiar.
 *
 * Importes en euros brutos. "Total mensual" = pagas ordinarias (12 al año);
 * las pagas extra (2 en el sector público y los convenios) se muestran aparte.
 * No incluyen trienios, carrera profesional, guardias ni turnicidad.
 */

export const SALARY_YEAR = 2026;

export const SALARY_SOURCES = {
  ingesa: {
    label: "INGESA — Retribuciones 2026 (Ministerio de Sanidad)",
    url: "https://ingesa.sanidad.gob.es/dam/jcr:ed0c64ae-7c62-480a-ab95-790e35bb4411/CUADERNO%20RETRIBUCIONES%202026.pdf",
  },
  ibsalut: {
    label: "IB-Salut — Tablas retributivas 2026",
    url: "https://ibsalut.es/docs/rrhh/normativa/instrucciones%20y%20circulares/es/Tablas%20retributivas_2026_ESP.pdf",
  },
  tcae: {
    label: "Ministerio de Sanidad — Informe TCAE 2025, tabla 9 (tablas oficiales 2024-2025)",
    url: "https://www.sanidad.gob.es/areas/cuidadosEnSalud/investigacionDatos/docs/2026_07_20_informe_TCAES_final.pdf",
  },
  dependencia: {
    label: "VIII Convenio marco estatal de dependencia — BOE-A-2023-13742, tabla 2025",
    url: "https://www.boe.es/boe/dias/2023/06/09/pdfs/BOE-A-2023-13742.pdf",
  },
  farmacia: {
    label: "XXV Convenio estatal de oficinas de farmacia — BOE-A-2026-4220",
    url: "https://www.boe.es/boe/dias/2026/02/23/pdfs/BOE-A-2026-4220.pdf",
  },
  cotizacion: {
    label: "Orden PJC/297/2026 — cotización a la Seguridad Social 2026 (BOE-A-2026-7296)",
    url: "https://www.boe.es/buscar/act.php?id=BOE-A-2026-7296",
  },
  irpf: {
    label: "AEAT — Retenciones sobre rendimientos del trabajo 2026",
    url: "https://sede.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/modelos/rw/retenciones2026.pdf",
  },
} as const;

type SourceKey = keyof typeof SALARY_SOURCES;

export type PayRow = {
  /** Servicio de salud o convenio. */
  service: string;
  year: number;
  /** Sueldo base mensual. */
  base: number;
  /** Complemento de destino mensual (null en convenios). */
  destination: number | null;
  /** Complemento específico + productividad fija + otros fijos (null en convenios). */
  specific: number | null;
  /** Total mensual en pagas ordinarias. */
  monthly: number;
  /** Importe de cada paga extra (null si la fuente no lo da). */
  extra: number | null;
  /** Bruto anual (14 pagas). */
  annual: number;
  /** true si el anual es una estimación (la fuente solo da el mensual). */
  estimated?: boolean;
  source: SourceKey;
  note?: string;
};

export type PayTable = { name: string; rows: PayRow[] };

export type Career = {
  slug: string;
  /** "enfermero/a" (en medio de frase). */
  label: string;
  careerName: string;
  /** Profesión de la taxonomía del sitio (landing de ofertas). */
  profession: string;
  intro: string;
  tables: PayTable[];
};

function ingesa(p: [number, number, number, number, number, number], note?: string): PayRow {
  const [base, destination, specific, monthly, extra, annual] = p;
  return { service: "INGESA (Ceuta y Melilla)", year: 2026, base, destination, specific, monthly, extra, annual, source: "ingesa", note };
}

function ibsalut(p: [number, number, number, number, number, number], note?: string): PayRow {
  const [base, destination, specific, monthly, extra, annual] = p;
  return { service: "IB-Salut (Baleares)", year: 2026, base, destination, specific, monthly, extra, annual, source: "ibsalut", note };
}

/** Fila del informe del Ministerio (solo mensual): anual estimado = 12 × mensual + 2 × (base + destino). */
function ministry(service: string, year: number, base: number, destination: number, specific: number, monthly: number, note?: string): PayRow {
  return {
    service,
    year,
    base,
    destination,
    specific,
    monthly,
    extra: null,
    annual: Math.round((monthly * 12 + 2 * (base + destination)) * 100) / 100,
    estimated: true,
    source: "tcae",
    note,
  };
}

/** Fila de convenio: salario base mensual en 14 pagas. */
function convenio(service: string, year: number, base: number, source: SourceKey): PayRow {
  return {
    service,
    year,
    base,
    destination: null,
    specific: null,
    monthly: base,
    extra: base,
    annual: Math.round(base * 14 * 100) / 100,
    source,
    note: "Sueldo base mínimo de convenio; sin antigüedad ni pluses.",
  };
}

export const CAREERS: Career[] = [
  {
    slug: "enfermero",
    label: "enfermero/a",
    careerName: "Enfermería (subgrupo A2)",
    profession: "Enfermería",
    intro:
      "En el sistema público, enfermería es del subgrupo A2: el sueldo base y el complemento de destino son comunes y lo que cambia entre servicios de salud es el complemento específico y la productividad fija. En residencias se aplica el convenio de dependencia.",
    tables: [
      {
        name: "Enfermero/a en hospital (hospitalización, quirófano, urgencias, UCI)",
        rows: [
          ingesa([1199.52, 592.11, 516.91, 2308.54, 1981.94, 31666.39]),
          ibsalut([1199.52, 592.11, 813.16, 2604.79, 1672.81, 34603.1]),
        ],
      },
      {
        name: "Matrona / enfermero/a obstétrico-ginecológico",
        rows: [
          ingesa([1199.52, 637.74, 527.44, 2364.7, 2027.57, 32431.58], "Matrona (atención especializada)."),
          ibsalut([1199.52, 637.73, 904.89, 2742.14, 1799.62, 36504.92]),
        ],
      },
      {
        name: "Enfermero/a de atención primaria y apoyo",
        rows: [
          ingesa([1199.52, 592.11, 583.44, 2375.07, 1832.08, 32165.03], "Enfermera de apoyo a la atención primaria / ESAD."),
          ibsalut([1199.52, 592.11, 669.04, 2460.67, 1530.63, 32589.3], "Enfermero/a de EAP."),
        ],
      },
      {
        name: "Enfermero/a en residencia (convenio de dependencia)",
        rows: [convenio("VIII Convenio de dependencia (ATS/DUE)", 2025, 1567.96, "dependencia")],
      },
    ],
  },
  {
    slug: "medico",
    label: "médico/a",
    careerName: "Medicina (subgrupo A1)",
    profession: "Medicina",
    intro:
      "Los facultativos son del subgrupo A1. La tabla recoge el sueldo base, el complemento de destino y los complementos fijos: no incluye guardias, que pueden sumar una parte importante del sueldo, ni la carrera profesional. La retribución de los médicos internos residentes (MIR) no se muestra porque no hemos verificado una tabla oficial por servicio de salud.",
    tables: [
      {
        name: "Facultativo/a especialista de área (FEA)",
        rows: [
          ingesa([1387.24, 729.14, 1891.6, 4007.98, 2911.08, 53917.9]),
          ibsalut([1387.24, 729.14, 2085.2, 4201.58, 1997.09, 54413.14]),
        ],
      },
      {
        name: "Médico/a de familia y atención primaria",
        rows: [
          ingesa([1387.24, 729.14, 1770.33, 3886.71, 2911.08, 52462.66], "Médico/a de ESAD (en equipos de atención primaria INGESA añade un variable por tarjetas sanitarias)."),
          ibsalut([1387.24, 729.14, 1519.53, 3635.91, 1997.09, 47625.1], "Médico/a general de EAP."),
        ],
      },
      {
        name: "Médico/a en residencia (convenio de dependencia)",
        rows: [convenio("VIII Convenio de dependencia (Médico)", 2025, 1791.96, "dependencia")],
      },
    ],
  },
  {
    slug: "tcae",
    label: "TCAE",
    careerName: "Técnico/a en cuidados auxiliares de enfermería (subgrupo C2)",
    profession: "TCAE",
    intro:
      "Las TCAE son del subgrupo C2 y cobran sueldo base y complemento de destino casi iguales en toda España; las diferencias entre comunidades vienen del complemento específico, la productividad fija y otros complementos autonómicos. La tabla por comunidades procede del informe del Ministerio de Sanidad sobre las TCAE.",
    tables: [
      {
        name: "TCAE en hospitalización, por servicio de salud",
        rows: [
          ministry("SERMAS (Madrid)", 2024, 716.98, 391.78, 395.45, 1504.21, "Incluye 266,59 € por acuerdo de mesa sectorial."),
          ministry("SAS (Andalucía)", 2024, 720.49, 420.74, 399.08, 1540.31),
          ministry("ICS (Cataluña)", 2024, 716.98, 391.78, 510.72, 1619.48),
          ministry("SERGAS (Galicia)", 2025, 716.98, 418.69, 330.3, 1465.97),
          ministry("Osakidetza (País Vasco)", 2024, 716.98, 412.36, 76.17, 1205.51),
          ministry("SESPA (Asturias)", 2025, 738.5, 407.62, 409.35, 1555.47),
          ministry("SCS (Cantabria)", 2024, 699.52, 382.24, 323.06, 1404.92),
          ministry("Salud (Aragón)", 2024, 720.49, 393.7, 429.01, 1543.2),
          ministry("SACYL (Castilla y León)", 2024, 720.49, 393.7, 362.82, 1477.01),
          ministry("SESCAM (Castilla-La Mancha)", 2025, 720.49, 393.7, 448.76, 1562.95),
          ministry("SES (Extremadura)", 2025, 720.49, 393.7, 414.66, 1528.85),
          ministry("SERIS (La Rioja)", 2025, 716.98, 391.78, 497.65, 1606.41),
          ministry("SMS (Murcia)", 2024, 716.98, 391.78, 506.82, 1615.58),
          ministry("SVS (C. Valenciana)", 2024, 716.98, 418.69, 410.25, 1545.92),
          ministry("IB-Salut (Baleares)", 2025, 720.49, 393.7, 609.87, 1724.06),
          ministry("SCS (Canarias)", 2025, 738.5, 409.13, 506.37, 1654.0, "Incluye 452,68 € de armonización retributiva."),
          ministry("INGESA (Ceuta y Melilla)", 2025, 720.49, 393.7, 382.91, 1497.11),
          ministry("Servicio Navarro de Salud", 2024, 1319.54, 592.68, 0, 1912.22, "Navarra tiene régimen foral y un sistema retributivo propio (niveles A-E)."),
        ],
      },
      {
        name: "Tablas 2026 publicadas por el servicio de salud",
        rows: [
          ingesa([749.59, 409.6, 398.38, 1557.57, 1483.07, 21656.95], "Auxiliar de enfermería en unidades de hospitalización."),
          ibsalut([749.58, 409.59, 634.5, 1793.67, 1262.48, 24049.0]),
        ],
      },
      {
        name: "Gerocultor/a en residencia (convenio de dependencia)",
        rows: [convenio("VIII Convenio de dependencia (Gerocultor)", 2025, 1160.37, "dependencia")],
      },
    ],
  },
  {
    slug: "tecnico-superior-sanitario",
    label: "técnico superior sanitario",
    careerName: "Técnico superior sanitario (subgrupo C1)",
    profession: "Técnico sanitario",
    intro:
      "Técnicos superiores en imagen para el diagnóstico, laboratorio, anatomía patológica, radioterapia, higiene bucodental y otros ciclos de grado superior sanitario son del subgrupo C1 en el sistema público.",
    tables: [
      {
        name: "Técnico/a superior sanitario (atención especializada)",
        rows: [
          ingesa([900.64, 465.75, 402.11, 1768.5, 1612.93, 24447.87], "Técnico superior (atención especializada)."),
          ibsalut([900.63, 465.75, 738.87, 2105.25, 1360.42, 27983.84], "Técnico/a especialista."),
        ],
      },
    ],
  },
  {
    slug: "fisioterapeuta",
    label: "fisioterapeuta",
    careerName: "Fisioterapia (subgrupo A2)",
    profession: "Fisioterapia",
    intro:
      "Los fisioterapeutas del sistema público son del subgrupo A2, con las mismas bases que enfermería. En residencias se aplica el convenio de dependencia.",
    tables: [
      {
        name: "Fisioterapeuta en atención especializada",
        rows: [
          ingesa([1199.52, 592.11, 540.9, 2332.53, 1981.94, 31954.27]),
          ibsalut([1199.52, 592.11, 813.16, 2604.79, 1672.81, 34603.1]),
        ],
      },
      {
        name: "Fisioterapeuta en residencia (convenio de dependencia)",
        rows: [convenio("VIII Convenio de dependencia (Fisioterapeuta)", 2025, 1455.98, "dependencia")],
      },
    ],
  },
  {
    slug: "celador",
    label: "celador/a",
    careerName: "Celador/a (agrupaciones profesionales)",
    profession: "Celador",
    intro:
      "Los celadores pertenecen a las agrupaciones profesionales (antiguo grupo E) y los complementos varían según el puesto y el servicio.",
    tables: [
      {
        name: "Celador/a con atención directa al enfermo",
        rows: [
          ingesa([686.07, 397.56, 429.02, 1512.64, 1360.75, 20873.24], "Nivel 14 con turnos, atención especializada."),
          ingesa([686.07, 397.56, 400.38, 1484.0, 1344.51, 20497.08], "Atención primaria."),
          ibsalut([686.07, 381.57, 667.56, 1735.2, 1173.93, 23170.26]),
        ],
      },
    ],
  },
  {
    slug: "farmaceutico",
    label: "farmacéutico/a",
    careerName: "Farmacia (subgrupo A1)",
    profession: "Farmacia",
    intro:
      "Los farmacéuticos del sistema público son del subgrupo A1. En oficinas de farmacia (el mayor mercado privado) el convenio estatal fija un sueldo base mínimo para los facultativos.",
    tables: [
      {
        name: "Farmacéutico/a en el sistema público",
        rows: [
          ingesa([1387.24, 729.14, 1456.04, 3572.42, 2911.08, 48691.18], "Farmacéutico (atención primaria)."),
          ibsalut([1387.24, 729.14, 1785.12, 3901.5, 1997.09, 50812.18], "Farmacéutico de atención primaria."),
        ],
      },
      {
        name: "Farmacéutico/a de oficina de farmacia (convenio estatal)",
        rows: [convenio("XXV Convenio de oficinas de farmacia (Facultativos)", 2026, 2223.37, "farmacia")],
      },
    ],
  },
];

export function careerFromSlug(slug: string) {
  return CAREERS.find((career) => career.slug === slug) ?? null;
}

export function careerForProfession(profession: string | null) {
  if (!profession) return null;
  return CAREERS.find((career) => career.profession === profession) ?? null;
}

/** Filas con tabla pública (excluye convenios): para rangos y "inicio". */
function publicRows(career: Career) {
  return career.tables.flatMap((t) => t.rows).filter((r) => r.destination !== null);
}

/** Rango de bruto anual ÷ 12 en el sistema público. */
export function careerRange(career: Career) {
  const all = publicRows(career).map((r) => r.annual / 12);
  return { min: Math.min(...all), max: Math.max(...all) };
}

/** Fila pública de entrada con menor anual (mínimo verificado). */
export function careerEntry(career: Career) {
  const rows = publicRows(career);
  const row = rows.reduce((a, b) => (a.annual <= b.annual ? a : b));
  return { row, annual: row.annual, monthlyEquivalent: row.annual / 12 };
}

// ---------------------------------------------------------------------------
// Seguridad Social + IRPF (estimación 2026)

export type HouseholdType = "single" | "single_parent" | "married_one" | "married_two";
export type ContractType = "indefinido" | "temporal";

/** Orden PJC/297/2026: tope máximo de la base de cotización, €/mes (Régimen General). */
export const MAX_CONTRIBUTION_BASE = 5101.2;
/** Cuota obrera 2026: contingencias comunes 4,70 % + MEI 0,15 % + FP 0,10 % + desempleo 1,55 % (indefinido) o 1,60 % (temporal). */
export const SS_RATES = {
  commonContingencies: 0.047,
  mei: 0.0015,
  training: 0.001,
  unemployment: { indefinido: 0.0155, temporal: 0.016 },
} as const;

export function socialSecurityRate(contract: ContractType) {
  return (
    SS_RATES.commonContingencies +
    SS_RATES.mei +
    SS_RATES.training +
    SS_RATES.unemployment[contract]
  );
}

/** Escala de retención (art. 101.1 LIRPF, AEAT cuadro 5): [límite superior, cuota acumulada hasta el tramo anterior, tipo]. */
const IRPF_SCALE: Array<[number, number, number, number]> = [
  // desde, hasta, cuota acumulada al inicio, tipo
  [0, 12450, 0, 0.19],
  [12450, 20200, 2365.5, 0.24],
  [20200, 35200, 4225.5, 0.3],
  [35200, 60000, 8725.5, 0.37],
  [60000, 300000, 17901.5, 0.45],
  [300000, Infinity, 125901.5, 0.47],
];

function applyScale(base: number) {
  if (base <= 0) return 0;
  const bracket = IRPF_SCALE.find(([, to]) => base <= to) ?? IRPF_SCALE[IRPF_SCALE.length - 1];
  return bracket[2] + (base - bracket[0]) * bracket[3];
}

/** Cuadro 1 AEAT (art. 81.1 RIRPF): límite excluyente de retención según situación e hijos (0, 1, 2+). */
const WITHHOLDING_LIMIT: Record<HouseholdType, [number, number, number]> = {
  single: [15876, 16342, 16867], // soltero sin hijos computados: "otras situaciones"
  single_parent: [15876, 17644, 18694],
  married_one: [17197, 18130, 19262],
  married_two: [15876, 16342, 16867],
};

function workReduction(netIncome: number) {
  if (netIncome <= 14852) return 7302;
  if (netIncome <= 17673.52) return 7302 - 1.75 * (netIncome - 14852);
  if (netIncome <= 19747.49) return 2364.34 - 1.14 * (netIncome - 17673.52);
  return 0;
}

const CHILD_MINIMUM = [2400, 2700, 4000, 4500];

function familyMinimum(children: number, under3: number) {
  let total = 5550;
  for (let i = 0; i < children; i += 1) total += CHILD_MINIMUM[Math.min(i, 3)];
  return total + 2800 * Math.min(under3, children);
}

export type NetInput = {
  /** Bruto anual total (suma de las 12 o 14 pagas). */
  annualGross: number;
  payments: 12 | 14;
  household: HouseholdType;
  children: number;
  /** De los hijos, cuántos tienen menos de 3 años. */
  childrenUnder3: number;
  contract: ContractType;
};

export type NetResult = {
  annualGross: number;
  socialSecurity: number;
  irpf: number;
  irpfRate: number;
  annualNet: number;
  /** Neto anual ÷ 12 (pagas extra prorrateadas). */
  netMonthlyEquivalent: number;
  /** Neto de cada paga ordinaria (con cuota de Seguridad Social del mes). */
  netOrdinaryPayment: number;
  /** Neto de cada paga extra (solo si 14 pagas). */
  netExtraPayment: number | null;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Estimación según el procedimiento general de retenciones de la AEAT 2026. */
export function netSalary(input: NetInput): NetResult {
  const { annualGross: gross, payments, household, contract } = input;
  const children = Math.max(0, Math.floor(input.children));
  const under3 = Math.min(Math.max(0, Math.floor(input.childrenUnder3)), children);

  const monthlyBase = Math.min(gross / 12, MAX_CONTRIBUTION_BASE);
  const socialSecurity = monthlyBase * 12 * socialSecurityRate(contract);

  const netIncome = gross - socialSecurity;
  const reduction = workReduction(netIncome);
  let base = netIncome - 2000 - reduction - (children > 2 ? 600 : 0);
  base = Math.max(0, base);

  const minimum = familyMinimum(children, under3);
  let quota = Math.max(0, applyScale(base) - applyScale(minimum));

  const limitRow = WITHHOLDING_LIMIT[household];
  const limit = limitRow[Math.min(children, 2)];
  if (gross <= limit) quota = 0;
  else if (gross <= 35200) quota = Math.min(quota, 0.43 * (gross - limit));

  const rate = gross > 0 ? Math.round((quota / gross) * 10000) / 10000 : 0;
  const irpf = gross * rate;
  const annualNet = gross - socialSecurity - irpf;
  const ordinaryGross = gross / payments;
  const ssMonthly = socialSecurity / 12;
  return {
    annualGross: r2(gross),
    socialSecurity: r2(socialSecurity),
    irpf: r2(irpf),
    irpfRate: rate,
    annualNet: r2(annualNet),
    netMonthlyEquivalent: r2(annualNet / 12),
    netOrdinaryPayment: r2(ordinaryGross * (1 - rate) - ssMonthly),
    netExtraPayment: payments === 14 ? r2(ordinaryGross * (1 - rate)) : null,
  };
}

export function formatEur(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEurRound(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
