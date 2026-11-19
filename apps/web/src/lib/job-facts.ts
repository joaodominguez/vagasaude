/**
 * Dados do resumo da vaga (saúde, PT). Funções puras e prudentes: só devolvem
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

/** Agências de recrutamento / trabalho temporário e anunciantes genéricos: o local de trabalho é do cliente. */
const AGENCY_RE =
  /randstad|adecco|manpower|gi group|tempo[- ]team|kelly services|hays\b|michael page|multipessoal|crit\b|eurofirms|vedior|people\s*&|talentia|entidade anunciante|empresa anunciante|confidencial|recrutamento|recursos humanos|\bworkforce\b/i;

// ---------- Horário ----------

const HOURS_RES = [
  /(?<![\d,./])(\d{1,2})(?:\s*(?:a|-|ou|e)\s*(\d{1,2}))?\s*(?:horas?|h)\s*(?:semanais|\/\s*semana|por\s+semana|na\s+semana|semanal)/g,
  /(?:regime|horario|periodo\s+normal)\s+(?:de\s+trabalho\s+)?(?:de\s+)?(\d{2})()\s*(?:horas?|h)\b/g,
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
  return `${[...found][0]} horas semanais`;
}

const NO_SHIFT_RE = /\bsem\s+(?:turnos|noites|trabalho\s+por\s+turnos|nocturn\w+|noturn\w+)\b|nao\s+(?:inclui|implica|tem)\s+(?:trabalho\s+por\s+)?turnos/;
const ROTATING_RE = /turnos?\s+rotativ\w+|rotacao\s+de\s+turnos|horario\s+rotativo|regime\s+de\s+turnos\s+rotativos/;
const SHIFT_RE = /\bturnos\b|\bpor\s+turno\b|trabalho\s+por\s+turnos|laboracao\s+continua|\b24\s*horas\b|\bh24\b/;
const MORNING_RE = /turno\s+da\s+manha|horario\s+da\s+manha|periodo\s+da\s+manha/;
const AFTERNOON_RE = /turno\s+da\s+tarde|horario\s+da\s+tarde|periodo\s+da\s+tarde/;
const NIGHT_RE = /turno\s+(?:da\s+noite|noturno|nocturno)|horario\s+(?:noturno|nocturno)|turnos?[^.\n]{0,40}noites?|\bnoites\b|trabalho\s+noturno|periodo\s+noturno/;
const WEEKEND_RE = /fins?\s+de\s+semana|\bfds\b|sabados?\s+e\s+domingos|feriados/;
const FULL_RE = /tempo\s+(?:inteiro|completo|integral)|horario\s+completo|full[- ]?time/;
const PART_RE = /tempo\s+parcial|meio[- ]periodo|horario\s+parcial|regime\s+parcial|part[- ]?time/;

/** «Tempo inteiro, por turnos (com noites)», «Tempo parcial», «35 horas semanais»… ou null. */
export function extractSchedule(text: string, contract?: string | null): string | null {
  const folded = foldText(`${text}\n${contract ?? ""}`);
  const hours = weeklyHours(folded);
  const full = FULL_RE.test(folded);
  const part = PART_RE.test(folded);
  const load = hours ?? (full && !part ? "Tempo inteiro" : part && !full ? "Tempo parcial" : null);

  let shift: string | null = null;
  const morning = MORNING_RE.test(folded);
  const afternoon = AFTERNOON_RE.test(folded);
  const night = NIGHT_RE.test(folded);
  if (!NO_SHIFT_RE.test(folded)) {
    if (ROTATING_RE.test(folded)) {
      shift = "turnos rotativos";
    } else if (SHIFT_RE.test(folded)) {
      shift = "por turnos";
    } else {
      const single = [morning && "turno da manhã", afternoon && "turno da tarde", night && "turno da noite"].filter(
        Boolean,
      ) as string[];
      if (single.length === 1) shift = single[0];
    }
    if (shift && WEEKEND_RE.test(folded)) shift += " (inclui fins de semana)";
    else if (shift && night && /turnos/.test(shift)) shift += " (com noites)";
  }
  if (load && shift) return `${load}, ${shift}`;
  if (shift) return shift.charAt(0).toUpperCase() + shift.slice(1);
  return load;
}

// ---------- Onde vais trabalhar ----------

type VenueRule = { re: RegExp; label: string };

/** Ordem = prioridade; o primeiro grupo «dominante» que coincide é o único devolvido. */
const DOMINANT_VENUES: VenueRule[] = [
  { re: /clinicas?\s+veterinari|hospital\s+veterinari|centro\s+veterinari|\bveterinari/, label: "Clínica veterinária" },
  { re: /clinicas?\s+dentari|medicina\s+dentaria|clinica\s+de\s+medicina\s+dentaria|consultorio\s+dentario|oralmed|smile\.?up/, label: "Clínica dentária" },
];

const VENUES: VenueRule[] = [
  { re: /\bhospital\w*|centro\s+hospitalar|servico\s+de\s+urgencia|\burgencias?\b|\buci\b|bloco\s+operatorio/, label: "Hospital" },
  { re: /\bclinica\s+(?!veterinari|dentari)\w+|centro\s+medico|policlinica|\bclinicas?\b/, label: "Clínica / centro médico" },
  { re: /\blar(?:es)?\s+(?:de\s+idosos|residencial)|\berpi\b|estrutura\s+residencial|residencia\s+(?:de\s+idosos|assistida|senior|geriatrica)|centro\s+de\s+dia|\bipss\b|lar\s+de\s+idosos|\bsantas?\s+casas?\b|misericordia/, label: "Lar / ERPI / IPSS" },
  { re: /cuidados\s+de\s+saude\s+primarios|centro\s+de\s+saude|\busf\b|\bucsp\b|\baces\b/, label: "Cuidados de saúde primários" },
  { re: /cuidados\s+continuados|\bucci?\b|\brncci\b|unidade\s+de\s+convalescenca/, label: "Cuidados continuados" },
  { re: /domicili\w*|apoio\s+domiciliario|\bsad\b|cuidados\s+ao\s+domicilio/, label: "Domicílio" },
  { re: /laborator\w+|analises\s+clinicas|posto\s+de\s+colheitas/, label: "Laboratório" },
  { re: /\bfarmacia\b|\bfarmacias\b/, label: "Farmácia" },
];

const PUBLIC_BODY_RE =
  /unidade\s+local\s+de\s+saude|\buls\b|centro\s+hospitalar|\bepe\b|instituto\s+portugues\s+de\s+oncologia|\bipo\b|administracao\s+regional\s+de\s+saude|\bars\b|agrupamento\s+de\s+centros\s+de\s+saude|\binem\b|\bsesaram\b|\bipst\b|direcao-?geral\s+da\s+saude|servico\s+regional\s+de\s+saude|\bsns\b/;

/** Tipo de estabelecimento quando o texto o diz claramente (máx. 2). */
export function extractVenue(
  text: string,
  company?: string | null,
  sector?: string | null,
): string | null {
  // Agências e anunciantes genéricos: o local é do cliente e costuma não ser claro.
  if (AGENCY_RE.test(company ?? "")) return null;
  const isPublic = sector === "Público";
  const head = foldText(`${company ?? ""}\n${text}`).slice(0, 500);
  const dominant = DOMINANT_VENUES.find((rule) => rule.re.test(head));
  if (dominant) return dominant.label;
  const hits = VENUES.map((rule) => ({ rule, m: rule.re.exec(head) }))
    .filter((x): x is { rule: VenueRule; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => a.m.index - b.m.index);
  if (hits.length > 2) return null;
  if (hits.length > 0) {
    const labels = hits.map((h) => {
      if (h.rule.label === "Hospital") {
        return sector === "Privado" ? "Hospital privado" : isPublic ? "Hospital público" : "Hospital";
      }
      return h.rule.label;
    });
    return labels.map((label, i) => (i === 0 ? label : lowerFirst(label))).join(", ");
  }
  if (isPublic && PUBLIC_BODY_RE.test(foldText(company ?? ""))) return "Unidade do SNS";
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
const YEARS_A_RE = new RegExp(
  String.raw`(?:pelo\s+menos|minimo(?:\s+de)?|minima\s+de|mais\s+de|de|com)\s+${NUM}\s+anos?\s+(?:de\s+)?experiencia`,
);
const YEARS_B_RE = new RegExp(
  String.raw`experiencia\s+(?:\w+\s+){0,3}?(?:de\s+)?(?:pelo\s+menos|minimo(?:\s+de)?|minima\s+de)?\s*(?:de\s+)?${NUM}\s+anos`,
);
const PREFERRED_RE = /valoriza\w*|preferencial|preferivel|desejavel|mais[- ]valia|sera\s+um\s+plus|\bplus\b/;
const ENTRY_RE =
  /(?:recem[- ]?licenciad\w+|recem[- ]?formad\w+|finalistas?)\s*(?:\w+\s+){0,2}?(?:bem[- ]vind\w+|aceit\w+|admitid\w+|valorizad\w+)|aceitam-?se\s+recem|candidaturas\s+de\s+recem|sem\s+experiencia(?:\s+previa)?|nao\s+(?:e\s+)?(?:necessaria|exigida|obrigatoria)\s+experiencia|experiencia\s+previa\s+nao\s+(?:e\s+)?(?:necessaria|exigida|obrigatoria)/;

/** «2 anos», «2 anos (preferencial)», «Aceitam-se recém-licenciados»… ou null. */
export function extractExperience(text: string): string | null {
  const folded = foldText(text);
  const entry = ENTRY_RE.exec(folded);
  if (entry) return /recem|finalist/.test(entry[0]) ? "Aceitam-se recém-licenciados" : "Sem experiência prévia";
  const match = YEARS_A_RE.exec(folded) ?? YEARS_B_RE.exec(folded);
  if (!match) return null;
  const years = toNumber(match[1]);
  if (!years) return null;
  const around = folded.slice(
    Math.max(0, (match.index ?? 0) - 60),
    (match.index ?? 0) + match[0].length + 60,
  );
  const label = years === 1 ? "1 ano" : `${years} anos`;
  return PREFERRED_RE.test(around) ? `${label} (preferencial)` : label;
}

// ---------- Cédula / Ordem profissional ----------

const ORDERS: Array<[RegExp, string]> = [
  [/ordem\s+dos\s+enfermeiros/, "Ordem dos Enfermeiros"],
  [/ordem\s+dos\s+medicos\s+dentistas/, "Ordem dos Médicos Dentistas"],
  [/ordem\s+dos\s+medicos\s+veterinarios/, "Ordem dos Médicos Veterinários"],
  [/ordem\s+dos\s+medicos/, "Ordem dos Médicos"],
  [/ordem\s+dos\s+farmaceuticos/, "Ordem dos Farmacêuticos"],
  [/ordem\s+dos\s+psicologos/, "Ordem dos Psicólogos"],
  [/ordem\s+dos\s+nutricionistas/, "Ordem dos Nutricionistas"],
  [/ordem\s+dos\s+biologos/, "Ordem dos Biólogos"],
];
const CEDULA_RE =
  /cedula\s+profissional|cedula\b|inscricao\s+(?:valida\s+|ativa\s+)?na\s+ordem|inscrito\s+na\s+ordem|membro\s+da\s+ordem|registo\s+na\s+ordem|\bordem\s+dos\s+\w+/;

/** «Cédula profissional (Ordem dos Enfermeiros)» se o texto a pede expressamente. */
export function extractCedula(text: string): string | null {
  const folded = foldText(text);
  const m = CEDULA_RE.exec(folded);
  if (!m) return null;
  const order = ORDERS.find(([re]) => re.test(folded))?.[1];
  const around = folded.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50);
  const label = order ? `Cédula profissional (${order})` : "Cédula profissional";
  return /valoriza|preferencial|desejavel/.test(around) ? `${label}, valorizada` : label;
}

// ---------- Especialidade ----------

const SPECIALTY_RES = [
  /\b(?:medic[oa]\/?a?\s+)?especialista\s+(?:em|de)\s+([^—–,()|]+?)(?:\s+[—–-]\s|[,()|]|$)/i,
  /\bespecialidade\s+(?:de|em)\s+([^—–,()|]+?)(?:\s+[—–-]\s|[,()|]|$)/i,
  /\bassistente(?:\s+graduado(?:\s+s[eé]nior)?|\s+hospitalar)?\s+de\s+([^—–,()|]+?)(?:\s+[—–-]\s|[,()|]|$)/i,
  /^enfermeir[oa](?:\/a)?(?:\s+especialista)?(?:\s+(?:de|em|no|na|do|da))?\s+([^—–,()|]+?)(?:\s+[—–-]\s|[,()|]|$)/i,
];
const SPECIALTY_NOISE = /^(?:cuidados\s+gerais|saude|geral)$/i;

/** Especialidade/serviço citado no título («Enfermeiro de Bloco Operatório» → «Bloco operatório»). */
export function specialtyFromTitle(title: string): string | null {
  const cleaned = title.replace(/\s*\(?\b(?:m\s*\/\s*f|f\s*\/\s*m)\b\.?\)?/gi, "");
  for (const re of SPECIALTY_RES) {
    const m = re.exec(cleaned);
    if (!m) continue;
    const value = m[1].replace(/\s+/g, " ").replace(/[\s.,;:-]+$/, "").trim();
    if (value.length < 4 || value.length > 36 || value.split(" ").length > 4) continue;
    if (/\d/.test(value) || /\b(?:em|de|e|para|do|da|a|o)$/i.test(value)) continue;
    if (SPECIALTY_NOISE.test(foldText(value))) continue;
    return value.charAt(0).toLocaleUpperCase("pt-PT") + value.slice(1).toLocaleLowerCase("pt-PT");
  }
  return null;
}

// ---------- Setor ----------

const SNS_RE =
  /unidade\s+local\s+de\s+saude|\buls\b|centro\s+hospitalar|\bepe\b|instituto\s+portugues\s+de\s+oncologia|\bipo\b|administracao\s+regional\s+de\s+saude|\bars\b|agrupamento\s+de\s+centros\s+de\s+saude|\binem\b|\bsesaram\b|\bipst\b|direcao-?geral\s+da\s+saude|servico\s+regional\s+de\s+saude|\bsns\b|hospital\s+(?:distrital|de\s+braga|garcia)/;

/** «Público (SNS)», «Público», «Privado», «Social (IPSS)». */
export function sectorLabel(job: { sector: string; company: string }): string {
  if (job.sector === "Público") {
    return SNS_RE.test(foldText(job.company)) ? "Público (SNS)" : "Público";
  }
  if (job.sector === "IPSS") return "Social (IPSS)";
  return job.sector;
}

// ---------- Local ----------

function usefulValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return !text || ["a combinar", "nao indicado", "n/d", "-"].includes(foldText(text)) ? null : text;
}

/** «Lisboa», «Cascais, Lisboa» (concelho + distrito quando difere). */
export function locationLabel(job: { city?: string | null; district?: string | null }): string | null {
  const city = usefulValue(job.city);
  const district = usefulValue(job.district);
  if (city && district && foldText(city) !== foldText(district)) return `${city}, ${district}`;
  return city ?? district;
}

const HEALTH_BODY_RE =
  /unidade\s+local\s+de\s+saude|\buls\b|centro\s+hospitalar|\bhospital\w*|\bepe\b|instituto\s+portugues\s+de\s+oncologia|\bipo\b|administracao\s+regional\s+de\s+saude|\bars\b|agrupamento\s+de\s+centros\s+de\s+saude|\baces\b|\binem\b|\bsesaram\b|\bipst\b|direcao-?geral\s+da\s+saude|servico\s+regional\s+de\s+saude|\bspms\b|infarmed|santa\s+casa|\bsns\b|saude/;

/** O organismo é uma unidade/serviço de saúde? (para a referência salarial nos concursos) */
export function isHealthBody(company: string | null | undefined): boolean {
  return HEALTH_BODY_RE.test(foldText(company ?? ""));
}
