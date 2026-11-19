/**
 * Datos del resumen de la oferta (sanidad, ES). Funciones puras y prudentes:
 * devuelven un valor solo cuando el texto lo dice de forma explícita.
 */
import { foldText } from "./display-title";

/** Título + descripción + requisitos (el título es la primera línea). */
export function jobFullText(job: {
  title: string;
  description: string;
  requirements?: string[];
}): string {
  return [job.title, job.description, ...(job.requirements ?? [])].filter(Boolean).join("\n");
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---------- Horario ----------

const HOURS_RES = [
  /(?<![\d,./])(\d{1,2})(?:\s*(?:a|-|y)\s*(\d{1,2}))?\s*(?:horas?|h)\s*(?:semanales|\/\s*semana|a\s+la\s+semana|por\s+semana|semanal)/g,
  /(?:jornada|horario|carga\s+horaria)\s+(?:laboral\s+)?(?:de\s+)?(\d{1,2})()\s*(?:horas?|h)\s+(?:semanales|a\s+la\s+semana)/g,
];

function weeklyHours(folded: string): string | null {
  const found = new Set<string>();
  for (const re of HOURS_RES) {
    for (const m of folded.matchAll(re)) {
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : null;
      if (a < 4 || a > 48 || (b != null && (b <= a || b > 48))) continue;
      found.add(b != null ? `${a}-${b}` : String(a));
    }
  }
  if (found.size !== 1) return null;
  return `${[...found][0]} horas semanales`;
}

const NO_SHIFT_RE = /\b(?:sin|no)\s+(?:turnos|guardias|noches|nocturnidad)\b/;
const ROTATING_RE = /turnos?\s+rotati\w+|rotatori\w+|rotacion\s+de\s+turnos|turnicidad/;
const SHIFT_RE = /\bturnos\b|\bturnicidad\b|\b24\s*h(?:oras)?\b|\bh24\b|cobertura\s+de\s+turnos/;
const MORNING_RE = /turno\s+de\s+manana|horario\s+de\s+manana|jornada\s+de\s+manana|por\s+las\s+mananas/;
const AFTERNOON_RE = /turno\s+de\s+tarde|horario\s+de\s+tarde|jornada\s+de\s+tarde|por\s+las\s+tardes/;
const NIGHT_RE = /turno\s+de\s+noche|turno\s+nocturno|horario\s+nocturno|turnos?[^.\n]{0,40}noche|\bnoches\b|nocturnidad/;
const WEEKEND_RE = /fines?\s+de\s+semana|findes?\b|sabados?\s+y\s+domingos|festivos/;
const FULL_RE = /jornada\s+(?:completa|integral)|tiempo\s+completo|full[- ]?time/;
const PART_RE = /jornada\s+(?:parcial|reducida)|tiempo\s+parcial|media\s+jornada|part[- ]?time/;

/** «Jornada completa, turnos rotatorios», «Media jornada», «Turno de noche»… o null. */
export function extractSchedule(text: string, contract?: string | null): string | null {
  const folded = foldText(`${text}\n${contract ?? ""}`);
  const hours = weeklyHours(folded);
  const full = FULL_RE.test(folded);
  const part = PART_RE.test(folded);
  const load = hours ?? (full && !part ? "Jornada completa" : part && !full ? "Jornada parcial" : null);

  let shift: string | null = null;
  const morning = MORNING_RE.test(folded);
  const afternoon = AFTERNOON_RE.test(folded);
  const night = NIGHT_RE.test(folded);
  if (!NO_SHIFT_RE.test(folded)) {
    if (ROTATING_RE.test(folded)) {
      shift = "turnos rotatorios";
    } else if (SHIFT_RE.test(folded)) {
      shift = "por turnos";
    } else {
      const single = [morning && "turno de mañana", afternoon && "turno de tarde", night && "turno de noche"].filter(
        Boolean,
      ) as string[];
      if (single.length === 1) shift = single[0];
    }
    if (shift && WEEKEND_RE.test(folded)) shift += " (incluye fines de semana)";
    else if (shift && night && /turnos/.test(shift)) shift += " (con noches)";
  }
  if (load && shift) return `${load}, ${shift}`;
  if (shift) return shift.charAt(0).toUpperCase() + shift.slice(1);
  return load;
}

// ---------- Dónde trabajarás ----------

type VenueRule = { re: RegExp; label: string };

/** Orden = prioridad; el primer grupo «dominante» que coincide es el único devuelto. */
const DOMINANT_VENUES: VenueRule[] = [
  { re: /clinicas?\s+veterinari|hospital\s+veterinari|centro\s+veterinari/, label: "Clínica veterinaria" },
  { re: /centro\s+penitenciari|instituciones\s+penitenciari/, label: "Centro penitenciario" },
  { re: /clinicas?\s+dental|clinica\s+odontolog|centro\s+odontolog/, label: "Clínica dental" },
];

const VENUES: VenueRule[] = [
  { re: /\bhospital\w*|complejo\s+hospitalari|\burgencias\b|\buci\b/, label: "Hospital" },
  { re: /clinica\s+(?!veterinari|dental)\w+|centro\s+medico|policlinic\w*/, label: "Clínica / centro médico" },
  { re: /residencias?\b|centro\s+residencial|geriatric\w*|centro\s+sociosanitari\w*|sociosanitari\w*|centro\s+de\s+dia|dependencia/, label: "Residencia / centro sociosanitario" },
  { re: /atencion\s+primaria|centro\s+de\s+salud|consultorio|ambulatori\w*|\bcap\b/, label: "Atención primaria / ambulatorio" },
  { re: /domicili\w*|\bsad\b|ayuda\s+a\s+domicilio|teleasistencia/, label: "Domicilio" },
  { re: /laborator\w+|centro\s+de\s+extraccion/, label: "Laboratorio" },
  { re: /oficinas?\s+de\s+farmacia|\bfarmacia\b/, label: "Farmacia" },
];

const PUBLIC_BODY_RE = /^(?:servicio\s+(?:andaluz|madrileno|gallego|canario|murciano|extremeno|aragones|navarro|vasco|catalan|cantabro|riojano|balear)|sas\b|sescam|sacyl|sergas|salud\b|osakidetza|ib-?salut|ics\b|sespa|scs\b|ingesa|gerencia)/;

/** Tipo de centro cuando el texto lo dice claramente (máx. 2). */
export function extractVenue(
  text: string,
  company?: string | null,
  isPublic = false,
): string | null {
  // ETT y agencias: el centro es del cliente y suele no estar claro.
  if (/\bett\b|randstad|adecco|manpower|gi group|synergie|temporing|grupo\s+eurofirms|empresa anunciante/i.test(company ?? "")) return null;
  const head = foldText(`${company ?? ""}\n${text}`).slice(0, 500);
  const dominant = DOMINANT_VENUES.find((rule) => rule.re.test(head));
  if (dominant) return dominant.label;
  const hits = VENUES.map((rule) => ({ rule, m: rule.re.exec(head) }))
    .filter((x): x is { rule: VenueRule; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => a.m.index - b.m.index);
  if (hits.length > 2) return null;
  if (hits.length > 0) {
    return hits.map((h, i) => (i === 0 ? h.rule.label : lowerFirst(h.rule.label))).join(", ");
  }
  if (isPublic && PUBLIC_BODY_RE.test(foldText(company ?? ""))) return "Servicio de salud";
  return null;
}

// ---------- Experiencia ----------

const NUMBER_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
};

function toNumber(raw: string): number | null {
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  return n && n >= 1 && n <= 15 ? n : null;
}

const NUM = String.raw`(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis)`;
const YEARS_A_RE = new RegExp(String.raw`(?:al\s+menos|minimo|min\.?|de)\s+${NUM}\s+anos?\s+(?:de\s+)?experiencia`);
const YEARS_B_RE = new RegExp(
  String.raw`experiencia\s+(?:\w+\s+){0,3}?(?:de\s+)?(?:al\s+menos|minimo|min\.?)?\s*(?:de\s+)?${NUM}\s+anos`,
);
const PREFERRED_RE = /valorable|se\s+valorar\w+|preferibl\w+|deseable|sera\s+un\s+plus|\bplus\b/;
const ENTRY_RE =
  /(?:recien\s+titulad\w+|recien\s+graduad\w+|sin\s+experiencia(?:\s+previa)?)\s*(?:\w+\s+){0,2}?(?:bienvenid\w+|admitid\w+|aceptad\w+|valorad\w+)|no\s+(?:es\s+)?(?:necesaria|imprescindible|requerida)\s+(?:tener\s+)?experiencia|sin\s+experiencia\s+(?:previa\s+)?(?:necesaria|requerida)|se\s+valoran\s+recien\s+titulad\w+|incorporacion\s+de\s+recien\s+titulad\w+/;

/** «2 años», «2 años (valorable)», «Se admiten recién titulados»… o null. */
export function extractExperience(text: string): string | null {
  const folded = foldText(text);
  const entry = ENTRY_RE.exec(folded);
  if (entry) return /recien/.test(entry[0]) ? "Se admiten recién titulados" : "Sin experiencia previa";
  const match = YEARS_A_RE.exec(folded) ?? YEARS_B_RE.exec(folded);
  if (!match) return null;
  const years = toNumber(match[1]);
  if (!years) return null;
  const around = folded.slice(
    Math.max(0, (match.index ?? 0) - 60),
    (match.index ?? 0) + match[0].length + 60,
  );
  const label = years === 1 ? "1 año" : `${years} años`;
  return PREFERRED_RE.test(around) ? `${label} (valorable)` : label;
}

// ---------- Colegiación ----------

const COLEG_RE = /colegiaci\w+|colegiad[oa]s?\b|numero\s+de\s+colegiad\w+|inscripcion\s+en\s+el\s+colegio|estar\s+colegiad\w+/;

/** «Colegiación vigente» si el texto la pide expresamente. */
export function extractColegiacion(text: string): string | null {
  const folded = foldText(text);
  const m = COLEG_RE.exec(folded);
  if (!m) return null;
  const around = folded.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50);
  return /valorable|se\s+valorar/.test(around) ? "Colegiación (valorable)" : "Colegiación necesaria";
}

// ---------- Especialidad ----------

const SPECIALTY_RES = [
  /\b(?:fea|facultativo\s+especialista(?:\s+de\s+area)?|medico\s+especialista)\s+(?:en|de)\s+([^—–,()]+?)(?:\s+[—–-]\s|[,()]|$)/i,
  /\bespecialista\s+en\s+([^—–,()]+?)(?:\s+[—–-]\s|[,()]|$)/i,
  /\bespecialidad\s+(?:de|en)\s+([^—–,()]+?)(?:\s+[—–-]\s|[,()]|$)/i,
  /\bm[eé]dico\/?a?\s+de\s+(familia|urgencias|urgencias hospitalarias|pediatr[ií]a)\b/i,
];

/** Especialidad citada en el título («FEA Cardiología» → «Cardiología»). */
export function specialtyFromTitle(title: string): string | null {
  for (const re of SPECIALTY_RES) {
    const m = re.exec(title);
    if (!m) continue;
    const value = m[1].replace(/\s+/g, " ").replace(/[\s.,;:-]+$/, "").trim();
    if (value.length < 4 || value.length > 42) continue;
    if (/\d/.test(value) || /\b(?:en|de|y|para|del|la)$/i.test(value)) continue;
    return value.charAt(0).toLocaleUpperCase("es-ES") + value.slice(1);
  }
  return null;
}

// ---------- Sector ----------

const SNS_RE =
  /servicio\s+(?:andaluz|madrileno|gallego|canario|murciano|extremeno|aragones|navarro|vasco|catalan|cantabro|riojano|balear|de\s+salud)|\bsas\b|sescam|sacyl|sergas|osakidetza|ib-?salut|\bics\b|\bsespa\b|\bscs\b|ingesa|\bsns\b|consejeria\s+de\s+sanidad|gerencia\s+(?:regional|de\s+atencion)|hospital\s+universitario|salud\b/;

/** «Público (SNS)», «Público», «Privado», «Concertado»… */
export function sectorLabel(job: { sector: string; company: string }): string {
  if (job.sector === "Público") {
    return SNS_RE.test(foldText(job.company)) ? "Público (SNS)" : "Público";
  }
  return job.sector;
}

// ---------- Lugar ----------

function usefulValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return !text || ["a convenir", "no indicado", "n/d", "-"].includes(foldText(text)) ? null : text;
}

/** «Madrid», «Getafe, Comunidad de Madrid» (ciudad + comunidad cuando difiere). */
export function locationLabel(job: { city?: string | null; district?: string | null }): string | null {
  const city = usefulValue(job.city);
  const district = usefulValue(job.district);
  if (city && district && foldText(city) !== foldText(district)) return `${city}, ${district}`;
  return city ?? district;
}

const HEALTH_BODY_RE =
  /servicio\s+(?:andaluz|madrileno|gallego|canario|murciano|extremeno|aragones|navarro|vasco|catalan|cantabro|riojano|balear|de\s+salud|asturiano)|\b(?:sas|sermas|scs|ics|sms|sescam|sacyl|sergas|sespa|salud|osakidetza|ingesa|ib-?salut|aragonsalud)\b|osakidetza|ib-?salut|gestion\s+sanitaria|hospital\w*|consorci\w*\s+sanitari\w*|consorcio\s+sanitari\w*|instituto\s+catalan\s+de\s+la\s+salud|institut\s+catala\s+de\s+la\s+salut|area\s+(?:de\s+)?salud|gerencia\s+(?:regional|de\s+atencion)|consejeria\s+de\s+(?:sanidad|salud)/;

/** ¿El organismo es un servicio de salud / hospital / consorcio sanitario? (para la referencia salarial en convocatorias) */
export function isHealthBody(company: string | null | undefined): boolean {
  return HEALTH_BODY_RE.test(foldText(company ?? ""));
}
