/**
 * Dati del riepilogo dell'offerta (sanità, IT). Funzioni pure e prudenti:
 * restituiscono un valore solo quando il testo lo dice in modo esplicito.
 */
import { foldText } from "./display-title";

/** Titolo + descrizione + requisiti (il titolo è la prima riga). */
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

// ---------- Orario ----------

const HOURS_RES = [
  /(?<![\d,./])(\d{1,2})(?:\s*(?:a|-|e)\s*(\d{1,2}))?\s*ore(?:\s+di\s+lavoro)?\s*(?:settimanali|\/\s*settimana|a\s+settimana|alla\s+settimana|la\s+settimana)/g,
  /(?:orario|monte\s+ore)\s+(?:di\s+lavoro\s+)?settimanale\s*(?:di|:|-)?\s*(\d{1,2})()\s*ore\b/g,
  /\borario\s*(?:di\s+lavoro)?\s*[:–-]\s*(\d{1,2})()\s*ore\b/g,
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
  return `${[...found][0]} ore settimanali`;
}

const NO_SHIFT_RE = /\b(?:senza|nessun|no|esclus\w+|escluso)\s+(?:turn\w+|notti|notte)\b/;
const SHIFT_RE = /\ba\s+turni\b|\bsu\s+(?:\d\s+)?turni\b|\bturni\b|\bturno\b|\bh\s?24\b|\bnelle\s+24\s+ore\b|\bcopertura\s+(?:dei\s+)?turni\b/;
const NIGHT_RE = /turn\w*[^.\n]{0,40}notturn|notturn\w*[^.\n]{0,30}turn|\bturni\s+di\s+notte|\bguardie\s+notturne|\bnotti\b/;
const WEEKEND_RE = /week[- ]?end|festiv[io]|sabato\s+e\s+domenica|fine\s+settimana/;
const FULL_RE = /tempo\s+pieno|full[- ]?time|orario\s+(?:pieno|completo)/;
const PART_RE = /part[- ]?time|tempo\s+parziale|orario\s+(?:ridotto|parziale)/;

/** «Tempo pieno, a turni», «Part-time», «36 ore settimanali, a turni (anche notte)»… o null. */
export function extractSchedule(text: string, contract?: string | null): string | null {
  const folded = foldText(`${text}\n${contract ?? ""}`);
  const hours = weeklyHours(folded);
  const full = FULL_RE.test(folded);
  const part = PART_RE.test(folded);
  const load = hours ?? (full && !part ? "Tempo pieno" : part && !full ? "Part-time" : null);

  let shift: string | null = null;
  if (!NO_SHIFT_RE.test(folded) && SHIFT_RE.test(folded)) {
    const extras: string[] = [];
    if (NIGHT_RE.test(folded)) extras.push("notte");
    if (WEEKEND_RE.test(folded)) extras.push("weekend");
    shift = extras.length ? `a turni (anche ${extras.join(" e ")})` : "a turni";
  }
  if (load && shift) return `${load}, ${shift}`;
  if (shift) return shift.charAt(0).toUpperCase() + shift.slice(1);
  return load;
}

// ---------- Dove lavorerai ----------

type VenueRule = { re: RegExp; label: string };

/** Ordine = priorità; il primo gruppo «dominante» che combacia è l'unico restituito. */
const DOMINANT_VENUES: VenueRule[] = [
  { re: /clinic[ah]\s+veterinari|ospedale\s+veterinari|ambulatorio\s+veterinari|centro\s+veterinari/, label: "Clinica veterinaria" },
  { re: /istitut[oi]\s+penitenziar|\bcarcer[ei]\b|casa\s+circondariale/, label: "Istituto penitenziario" },
  { re: /studio\s+(?:dentistic|odontoiatric)|clinic[ah]\s+(?:dentale|dentistic|odontoiatric)|centro\s+odontoiatric/, label: "Studio odontoiatrico" },
];

const VENUES: VenueRule[] = [
  { re: /\bospedal\w*|presidio\s+ospedalier|\birccs\b|policlinic\w*|pronto\s+soccorso/, label: "Ospedale" },
  { re: /casa\s+di\s+cura|(?<!condizioni\s|cartelle\s|documentazione\s)\bclinic[ah]\b(?!\s+veterinar)|istituto\s+clinico|istituti\s+clinici/, label: "Clinica / casa di cura" },
  { re: /\brsa\b|residenza\s+sanitaria|casa\s+di\s+riposo|residenza\s+per\s+anziani|\bcra\b|lungodegenza|\bhospice\b|\brsd\b/, label: "RSA / residenza" },
  { re: /poliambulatori\w*|\bambulatori\w*|centro\s+medico|centro\s+diagnostic\w*/, label: "Poliambulatorio / ambulatorio" },
  { re: /\bdomicili\w*|\badi\b|assistenza\s+domiciliare|casa\s+della\s+comunita|consultori\w*|\bdistrett\w*/, label: "Territorio e domicilio" },
  { re: /laborator\w+|centro\s+prelievi/, label: "Laboratorio" },
  { re: /\bfarmaci[ae]\b/, label: "Farmacia" },
];

const PUBLIC_BODY_RE = /^(?:azienda|asl\b|asst\b|ausl\b|ulss\b|asp\b|ats\b|ente\s+ospedalier|fondazione\s+irccs)/;

/** Tipo di struttura quando il testo lo dice chiaramente (max 2). */
export function extractVenue(
  text: string,
  company?: string | null,
  isPublic = false,
): string | null {
  // Agenzie per il lavoro: la struttura è del cliente e di solito non è chiara.
  if (/agenzia per il lavoro|randstad|adecco|manpower|gi group|umana|synergie|openjobmetis/i.test(company ?? "")) return null;
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
  if (isPublic && PUBLIC_BODY_RE.test(foldText(company ?? ""))) return "Azienda sanitaria";
  return null;
}

// ---------- Esperienza ----------

const NUMBER_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6,
};

function toNumber(raw: string): number | null {
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  return n && n >= 1 && n <= 15 ? n : null;
}

const YEARS_A_RE =
  /(?:almeno|minimo|min\.?|di)\s+(\d{1,2}|un|uno|due|tre|quattro|cinque|sei)\s+ann[io]\s+(?:di\s+)?esperienza/;
const YEARS_B_RE =
  /esperienza\s+(?:\w+\s+){0,3}?(?:di\s+)?(?:almeno|minimo|min\.?)?\s*(?:di\s+)?(\d{1,2}|un|uno|due|tre|quattro|cinque|sei)\s+ann[io]/;
const PREFERRED_RE = /prefer\w+|gradit\w+|titolo\s+preferenziale|costituisc\w+\s+titolo|valutat\w+/;
const ENTRY_RE =
  /anche\s+(?:se\s+)?(?:neolaureat\w+|neodiplomat\w+|senza\s+esperienza)|neolaureat\w+\s+(?:benvenut\w+|ammess\w+|accettat\w+)|(?:non\s+(?:e|è)\s+richiesta|senza\s+richiedere)\s+(?:alcuna\s+)?esperienza|senza\s+esperienza\s+(?:pregressa\s+)?(?:richiesta|necessaria)/;

/** «2 anni», «2 anni (preferenziale)», «Anche neolaureati»… o null. */
export function extractExperience(text: string): string | null {
  const folded = foldText(text);
  if (ENTRY_RE.test(folded)) {
    return /neolaureat/.test(folded.match(ENTRY_RE)![0]) ? "Anche neolaureati" : "Anche senza esperienza";
  }
  const match = YEARS_A_RE.exec(folded) ?? YEARS_B_RE.exec(folded);
  if (!match) return null;
  const years = toNumber(match[1]);
  if (!years) return null;
  const around = folded.slice(
    Math.max(0, (match.index ?? 0) - 60),
    (match.index ?? 0) + match[0].length + 60,
  );
  const label = years === 1 ? "1 anno" : `${years} anni`;
  return PREFERRED_RE.test(around) ? `${label} (preferenziale)` : label;
}

// ---------- Specialità ----------

const SPECIALTY_RES = [
  /\bdirigente\s+(?:medico|odontoiatra|veterinario|farmacista|biologo|psicologo|chimico|fisico)\s*[–-]\s*([^—–]+?)(?:\s+[—–]\s|$)/i,
  /\bdisciplina\s+(?:di|in)\s+([^—–,()]+?)(?:\s+[—–]\s|[,()]|$)/i,
  /\bmedico\s+specializzat\w+\s+in\s+([^—–,()]+?)(?:\s+[—–-]\s|[,()]|$)/i,
  /\bspecialist\w+\s+in\s+([^—–,()]+?)(?:\s+[—–-]\s|[,()]|$)/i,
];

/** Specialità citata nel titolo («Dirigente Medico – Cardiologia» → «Cardiologia»). */
export function specialtyFromTitle(title: string): string | null {
  for (const re of SPECIALTY_RES) {
    const m = re.exec(title);
    if (!m) continue;
    const value = m[1].replace(/\s+/g, " ").replace(/[\s.,;:-]+$/, "").trim();
    if (value.length < 4 || value.length > 42) continue;
    if (/\d/.test(value) || /^ruolo\b/i.test(value) || /\b(?:in|di|e|per|del|della)$/i.test(value)) continue;
    return value.charAt(0).toLocaleUpperCase("it-IT") + value.slice(1);
  }
  return null;
}

// ---------- Settore ----------

const SSN_RE =
  /azienda\s+(?:unit|socio|sanit|ospedal|usl|zero|regionale)|\basl\b|\basst\b|\bausl\b|\bulss\b|\basp\b|\bats\b|\birccs\b|policlinic|ospedal|\bsan\b/;

/** «Pubblico (SSN)», «Privato», «Privato accreditato»… */
export function sectorLabel(job: { sector: string; company: string }): string {
  if (job.sector === "Pubblico") {
    return SSN_RE.test(foldText(job.company)) ? "Pubblico (SSN)" : "Pubblico";
  }
  if (job.sector === "Accreditato") return "Privato accreditato";
  return job.sector;
}

// ---------- Luogo ----------

function usefulValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return !text || ["da definire", "non indicato", "n/d", "-"].includes(foldText(text)) ? null : text;
}

/** «Milano», «Cascina, Toscana» (città + regione quando differisce). */
export function locationLabel(job: { city?: string | null; district?: string | null }): string | null {
  const city = usefulValue(job.city);
  const district = usefulValue(job.district);
  if (city && district && foldText(city) !== foldText(district)) return `${city}, ${district}`;
  return city ?? district;
}
