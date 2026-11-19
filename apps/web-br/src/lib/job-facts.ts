/**
 * Dados do resumo da vaga (saúde, BR). Funções puras e prudentes: só devolvem um
 * valor quando o texto o diz de forma explícita.
 */
import { foldText } from "./display-title";

/** Título + descrição + requisitos (o título é a primeira linha). */
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

// ---------- Horário / escala ----------

/** «44 h semanais», «36 horas semanais», «carga horária de 40h». */
const HOURS_RES = [
  /(?<![\d,./])(\d{2})\s*(?:h|hs|horas?)\s*(?:semanais|\/\s*semana|por\s+semana|na\s+semana)/g,
  /carga\s+horaria\s+(?:semanal\s+)?(?:de\s+|:|-)?\s*(\d{2})\s*(?:h|hs|horas?)\b/g,
  /jornada\s+(?:de\s+trabalho\s+)?(?:semanal\s+)?(?:de\s+|:|-)?\s*(\d{2})\s*(?:h|hs|horas?)\b/g,
];

function weeklyHours(folded: string): string | null {
  const found = new Set<string>();
  for (const re of HOURS_RES) {
    for (const m of folded.matchAll(re)) {
      const a = Number(m[1]);
      if (a < 12 || a > 48) continue;
      found.add(String(a));
    }
  }
  if (found.size !== 1) return null;
  return `${[...found][0]} h semanais`;
}

/** Escala «12x36», «12 x 36», «12×36», «6x1», «5x2», «24x72», «12x60». */
const SCALE_RE = /(?<![\d])(12\s*[x×]\s*36|12\s*[x×]\s*60|24\s*[x×]\s*(?:48|72)|6\s*[x×]\s*1|5\s*[x×]\s*2|4\s*[x×]\s*2)(?![\d])/;
const NIGHT_RE = /\bnoturn\w*|\bnoite\b|\b19\s*h?\s*(?:as|a|-)\s*(?:07|7)\s*h|\b19:00\s*(?:as|a|-)\s*07:00/;
const DAY_RE = /\bdiurn\w*|\b07\s*h?\s*(?:as|a|-)\s*19\s*h|\b07:00\s*(?:as|a|-)\s*19:00/;
const WEEKEND_RE = /fins?\s+de\s+semana|\bfim\s+de\s+semana|\bfinais?\s+de\s+semana|\bfinal\s+de\s+semana|feriados?/;
const PLANTAO_RE = /\bplant(?:ao|oes)\b|\bplantonista\b/;
const DIARISTA_RE = /\bdiarista\b/;
const FULL_RE = /tempo\s+integral|periodo\s+integral|full[- ]?time|\bclt\s+44\b/;
const PART_RE = /meio\s+periodo|part[- ]?time|tempo\s+parcial|carga\s+reduzida/;

function normalizeScale(raw: string): string {
  return raw.replace(/\s+/g, "").replace("×", "x");
}

/**
 * «Escala 12x36 (noturna)», «44 h semanais, escala 6x1», «Plantão», «Diarista»,
 * «Tempo integral»… ou null.
 */
export function extractSchedule(text: string, contract?: string | null): string | null {
  const folded = foldText(`${text}\n${contract ?? ""}`);
  const hours = weeklyHours(folded);
  const scaleMatch = SCALE_RE.exec(folded);
  const full = FULL_RE.test(folded);
  const part = PART_RE.test(folded);
  const load = hours ?? (full && !part ? "Tempo integral" : part && !full ? "Meio período" : null);

  let shift: string | null = null;
  if (scaleMatch) {
    const around = folded.slice(
      Math.max(0, scaleMatch.index - 50),
      scaleMatch.index + scaleMatch[0].length + 60,
    );
    const night = NIGHT_RE.test(around);
    const day = DAY_RE.test(around);
    const extra = night && !day ? " noturna" : day && !night ? " diurna" : "";
    shift = `escala ${normalizeScale(scaleMatch[1])}${extra}`;
  } else if (PLANTAO_RE.test(folded)) {
    const night = NIGHT_RE.test(folded);
    const day = DAY_RE.test(folded);
    shift = night && !day ? "plantões noturnos" : day && !night ? "plantões diurnos" : "plantões";
  } else if (DIARISTA_RE.test(folded)) {
    shift = "diarista";
  }
  if (shift && WEEKEND_RE.test(folded) && !/fins?\s+de\s+semana/.test(shift)) {
    shift += " (inclui fins de semana/feriados)";
  }
  if (load && shift) return `${load}, ${shift}`;
  if (shift) return shift.charAt(0).toUpperCase() + shift.slice(1);
  return load;
}

/** A escala/plantão é um fator relevante para o cartão? Devolve a etiqueta curta. */
export function shiftChipLabel(schedule: string | null): string | null {
  if (!schedule) return null;
  const scale = /(\d{1,2}x\d{1,2})/.exec(schedule);
  if (scale) return `Escala ${scale[1]}`;
  if (/plant/i.test(schedule)) return "Plantão";
  if (/diarista/i.test(schedule)) return "Diarista";
  return null;
}

// ---------- Onde vai trabalhar ----------

type VenueRule = { re: RegExp; label: string };

const DOMINANT_VENUES: VenueRule[] = [
  { re: /clinica\s+veterinaria|hospital\s+veterinario|pet\s*shop|\bpetz\b/, label: "Clínica veterinária" },
  { re: /unidade\s+prisional|penitenciari|sistema\s+prisional/, label: "Unidade prisional" },
  { re: /consultorio\s+odontologico|clinica\s+odontologica|\bodontologia\b.{0,20}\bclinica/, label: "Clínica odontológica" },
  { re: /\bdrogaria\b|\bfarmacia\b|\braia\b|\bdrogasil\b|\bpanvel\b|\bpague\s+menos\b/, label: "Farmácia / drogaria" },
];

const VENUES: VenueRule[] = [
  { re: /\bhospita\w*|\buti\b|\bcti\b|pronto[- ]socorro|\bups\b|\bupa\b|\bmaternidade\b/, label: "Hospital" },
  { re: /\bclinica\b(?!\s+(?:medica\s+)?geral)|\bpoliclinica\b|centro\s+medico/, label: "Clínica" },
  { re: /\bubs\b|unidade\s+basica|posto\s+de\s+saude|\besf\b|estrategia\s+(?:de\s+)?saude\s+da\s+familia|\bcaps\b|\bcras\b|\bsamu\b/, label: "Rede básica / UBS" },
  { re: /\bhome\s*care\b|atendimento\s+domiciliar|assistencia\s+domiciliar|\bdomicilio\b|\bdomiciliar\b/, label: "Home care / domicílio" },
  { re: /laborator\w+|coleta\s+(?:de\s+)?(?:sangue|material)|posto\s+de\s+coleta|diagnostic\w+\s+por\s+imagem/, label: "Laboratório / diagnóstico" },
  { re: /\bambulatori\w+/, label: "Ambulatório" },
  { re: /\binstituicao\s+de\s+longa\s+permanencia\b|\bilpi\b|casa\s+de\s+repouso|lar\s+de\s+idosos/, label: "ILPI / casa de repouso" },
];

const PUBLIC_BODY_RE = /^(?:prefeitura|secretaria|fundacao\s+(?:estatal|municipal)|hospital\s+(?:municipal|estadual|universitario)|ebserh|governo)/;

/** Tipo de estabelecimento quando o texto o diz com clareza (no máximo 2). */
export function extractVenue(
  text: string,
  company?: string | null,
  isPublic = false,
): string | null {
  const head = foldText(`${company ?? ""}\n${text}`).slice(0, 600);
  const dominant = DOMINANT_VENUES.find((rule) => rule.re.test(head));
  if (dominant) return dominant.label;
  const hits = VENUES.map((rule) => ({ rule, m: rule.re.exec(head) }))
    .filter((x): x is { rule: VenueRule; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => a.m.index - b.m.index);
  if (hits.length > 2) return null;
  if (hits.length > 0) {
    return hits.map((h, i) => (i === 0 ? h.rule.label : lowerFirst(h.rule.label))).join(", ");
  }
  if (isPublic && PUBLIC_BODY_RE.test(foldText(company ?? ""))) return "Órgão público";
  return null;
}

// ---------- Experiência ----------

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
};

function toNumber(raw: string): number | null {
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  return n && n >= 1 && n <= 15 ? n : null;
}

const NUM = String.raw`(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis)`;
const YEARS_A_RE = new RegExp(String.raw`(?:minim[oa]\s+de|minimo|no\s+minimo|pelo\s+menos|ao\s+menos|de)\s+${NUM}\s+anos?\s+(?:de\s+)?experiencia`);
const YEARS_B_RE = new RegExp(String.raw`experiencia\s+(?:\w+\s+){0,3}?(?:de\s+)?(?:minim[oa]\s+de\s+|no\s+minimo\s+|pelo\s+menos\s+)?${NUM}\s+anos?`);
const PREFERRED_RE = /diferencial|desejavel|preferenc\w+|sera\s+um\s+diferencial|constitui\s+diferencial/;
const ENTRY_RE =
  /(?:sem|nao\s+(?:e\s+)?(?:necessari[ao]|exigid[ao]|requerid[ao]))\s+(?:a\s+)?(?:previa\s+)?experiencia|experiencia\s+(?:previa\s+)?(?:nao\s+(?:e\s+)?(?:necessaria|exigida|obrigatoria))|aceita(?:mos)?\s+recem[- ]?formad\w+|recem[- ]?formad\w+\s+(?:sao\s+)?(?:bem[- ]?vind\w+|aceit\w+)|primeiro\s+emprego/;

/** «2 anos», «2 anos (diferencial)», «Aceita recém-formados»… ou null. */
export function extractExperience(text: string): string | null {
  const folded = foldText(text);
  const entry = ENTRY_RE.exec(folded);
  if (entry) {
    return /recem/.test(entry[0]) ? "Aceita recém-formados" : "Sem experiência prévia";
  }
  const match = YEARS_A_RE.exec(folded) ?? YEARS_B_RE.exec(folded);
  if (!match) return null;
  const years = toNumber(match[1]);
  if (!years) return null;
  const around = folded.slice(
    Math.max(0, (match.index ?? 0) - 60),
    (match.index ?? 0) + match[0].length + 60,
  );
  const label = years === 1 ? "1 ano" : `${years} anos`;
  return PREFERRED_RE.test(around) ? `${label} (diferencial)` : label;
}

/** Registro profissional exigido no texto: COREN, CRM, CRF, CREFITO, CRP, CRN, CRO, CREFONO. */
const COUNCIL_RE = /\b(coren|crm|crf|crefito|crp|crn|cro|crefono|cress|crbm|crmv)\b/i;

export function extractCouncil(text: string): string | null {
  const m = COUNCIL_RE.exec(text);
  return m ? m[1].toUpperCase() : null;
}

// ---------- Área / especialidade ----------

const AREA_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /\buti\s+(?:neo\w*|pediatric\w*|adulto|geral|coronariana)|\buti\b|\bcti\b|terapia\s+intensiva/i, label: "UTI" },
  { re: /pronto[- ]socorro|\bps\b|urgencia|emergencia|\bupa\b/i, label: "Urgência e emergência" },
  { re: /centro\s+cirurgico|bloco\s+(?:cirurgico|operatorio)|\bcme\b/i, label: "Centro cirúrgico" },
  { re: /hemodinamica/i, label: "Hemodinâmica" },
  { re: /hemodialise|nefrologia/i, label: "Hemodiálise" },
  { re: /oncolog\w+|quimioterapia/i, label: "Oncologia" },
  { re: /home\s*care|domiciliar/i, label: "Home care" },
  { re: /obstetric\w+|maternidade|centro\s+obstetrico/i, label: "Maternidade" },
  { re: /pediatri\w+|neonat\w+/i, label: "Pediatria" },
  { re: /saude\s+mental|psiquiatr\w+|\bcaps\b/i, label: "Saúde mental" },
  { re: /\bscih\b|controle\s+de\s+infeccao/i, label: "SCIH" },
  { re: /auditoria/i, label: "Auditoria" },
];

const MEDICAL_RE = /\bm[eé]dic[oa]s?\s*(?:\(a\))?\s+(?:da\s+familia|do\s+trabalho|(?:cardiolog|ortoped|pediatr|ginecolog|anestesi|intensiv|neurolog|psiquiatr|radiolog|dermatolog|oftalmolog|urolog|cirurg|clinic|geriatr|infectolog|oncolog|endocrin|gastro|pneumo|otorrino|nefrolog|reumat|hematolog)\w*)/i;

/** Área citada no título («Enfermeiro UTI Adulto» → «UTI», «Médico Cardiologista» → «Cardiologista»). */
export function specialtyFromTitle(title: string): string | null {
  const t = foldText(title);
  const med = MEDICAL_RE.exec(title);
  if (med) {
    const words = med[0].replace(/\s+/g, " ").split(" ").slice(1).join(" ").replace(/^\(a\)\s*/i, "");
    const value = words.replace(/^da\s+/i, "da ").trim();
    if (value.length >= 4 && value.length <= 32) return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
  }
  for (const rule of AREA_RULES) {
    if (rule.re.test(t)) return rule.label;
  }
  return null;
}

// ---------- Setor ----------

const SUS_RE =
  /prefeitura|secretaria\s+(?:municipal|estadual)|\bsus\b|\bebserh\b|hospital\s+(?:municipal|estadual|universitario|federal)|fundacao\s+estatal|governo\s+do\s+estado|\bupa\b|\bsamu\b/;

/** «Público (SUS)», «Privado», «Filantrópico»… */
export function sectorLabel(job: { sector: string; company: string }): string {
  if (job.sector === "Público") {
    return SUS_RE.test(foldText(job.company)) ? "Público (SUS)" : "Público";
  }
  return job.sector;
}

// ---------- Local ----------

function usefulValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return !text || ["a definir", "nao informado", "n/d", "-", "none"].includes(foldText(text)) ? null : text;
}

/** «Campinas, São Paulo» (cidade + estado quando diferem). */
export function locationLabel(job: { city?: string | null; district?: string | null }): string | null {
  const city = usefulValue(job.city);
  const district = usefulValue(job.district);
  if (city && district && foldText(city) !== foldText(district)) return `${city}, ${district}`;
  return city ?? district;
}
