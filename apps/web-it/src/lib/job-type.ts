import type { Job } from "@/lib/jobs";
import { SOURCE_META } from "@/lib/sources";

/**
 * Tipo di offerta. "offerta" e' il valore di default (lavoro privato, o
 * pubblico senza una procedura selettiva identificabile).
 */
export type JobType =
  | "concorso"
  | "graduatoria"
  | "mobilita"
  | "tempo_determinato"
  | "incarico"
  | "offerta";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  concorso: "Concorso pubblico",
  graduatoria: "Graduatoria",
  mobilita: "Mobilità",
  tempo_determinato: "Avviso a tempo determinato",
  incarico: "Incarico libero-professionale",
  offerta: "Offerta di lavoro",
};

/** Tipi mostrati in /concorsi (solo lavoro pubblico con procedura selettiva o avviso). */
export const CONCORSI_TYPES: readonly JobType[] = [
  "concorso",
  "graduatoria",
  "mobilita",
  "tempo_determinato",
  "incarico",
];

/** Fonti che pubblicano esclusivamente lavoro pubblico anche se il settore non e' indicato. */
const PUBLIC_SOURCES = new Set<string>([]);

function norm(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isPublicJob(job: Pick<Job, "sector" | "source">) {
  if (job.sector === "Pubblico") return true;
  const source = job.source?.toLowerCase();
  if (!source) return false;
  return PUBLIC_SOURCES.has(source) || SOURCE_META[source]?.sector === "Pubblico";
}

// Pattern su testo normalizzato (senza accenti, minuscolo).
const MOBILITA_RE =
  /mobilita (volontaria|interregionale|compartimentale|esterna|intercompartimentale|interna)|avviso (pubblico )?di mobilita|passaggio diretto|trasferimento (volontario|tra aziende)/;
const GRADUATORIA_RE =
  /graduatori[ae]|elenco (degli )?idonei|short list|formazione (di )?(una |un )?(graduatoria|elenco)|scorrimento (di )?graduatoria|lista (di )?(attesa|reclutamento)/;
const CONCORSO_RE =
  /\bconcors[oi]\b|concorso pubblico|pubblico concorso|selezione pubblica|procedura selettiva|prova (preselettiva|selettiva|scritta)|per titoli ed esami|per soli titoli|\bpnrr\b|stabilizzazione|tempo indeterminato.*(concorso|selezione)/;
const INCARICO_RE =
  /incarico (libero[- ]professionale|di collaborazione|professionale)|libero[- ]professionist|co\.?co\.?co|collaborazione coordinata|lavoro autonomo|prestazione (d opera|occasionale)|contratto di consulenza/;
const TEMPO_DET_RE =
  /(avviso|selezione)( pubblic[oa])?.{0,60}tempo determinato|tempo determinato|incarico a tempo|incarichi a tempo|incarico (di )?sostituzione|supplenza|\bsostituzione\b/;

/**
 * Classifica l'offerta per tipo. Solo il lavoro pubblico puo' essere concorso,
 * graduatoria, mobilita', avviso a tempo determinato o incarico; il resto e'
 * sempre "offerta".
 *
 * 1. Titoli che iniziano con la parola del tipo ("Concorso ...", "Mobilità ...").
 * 2. Titoli ufficiali lunghi: pattern nel titolo.
 * 3. Ultima risorsa: pattern forti nell'incipit della descrizione.
 * Priorita': mobilita' > graduatoria > concorso > incarico > tempo determinato,
 * perche' un avviso di mobilita' puo' citare "tempo indeterminato" o "concorso".
 */
export function classifyJob(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
): JobType {
  const cached = typeCache.get(job);
  if (cached) return cached;
  const type = classifyUncached(job);
  typeCache.set(job, type);
  return type;
}

const typeCache = new WeakMap<object, JobType>();

function classifyUncached(
  job: Pick<Job, "title" | "description" | "sector" | "source">,
): JobType {
  if (!isPublicJob(job)) return "offerta";

  const title = norm(job.title);

  // 1) Prefisso esplicito.
  if (/^(avviso (pubblico )?di )?mobilita\b/.test(title)) return "mobilita";
  if (/^graduatori[ae]\b/.test(title)) return "graduatoria";
  if (/^concors[oi]\b/.test(title)) return "concorso";
  if (/^incarico (libero|di collaborazione)/.test(title)) return "incarico";

  // 2) Titolo ufficiale lungo.
  const byTitle = matchPatterns(title);
  if (byTitle) return byTitle;

  // 3) Descrizione (solo l'incipit, per evitare citazioni incidentali).
  const lead = norm(job.description).slice(0, 400);
  const byLead = matchPatterns(lead, true);
  if (byLead) return byLead;

  return "offerta";
}

function matchPatterns(text: string, strictOnly = false): JobType | null {
  if (MOBILITA_RE.test(text)) return "mobilita";
  if (strictOnly) {
    // Nella descrizione vale solo cio' che e' inequivocabile.
    if (/graduatori[ae]/.test(text)) return "graduatoria";
    if (/concorso pubblico|pubblico concorso|per titoli ed esami|procedura selettiva/.test(text)) {
      return "concorso";
    }
    return null;
  }
  if (GRADUATORIA_RE.test(text)) return "graduatoria";
  if (CONCORSO_RE.test(text)) return "concorso";
  if (INCARICO_RE.test(text)) return "incarico";
  if (TEMPO_DET_RE.test(text)) return "tempo_determinato";
  return null;
}

/** Appartiene a /concorsi? (concorso, graduatoria, mobilita', avviso o incarico pubblico). */
export function isConcorsoJob(job: Pick<Job, "title" | "description" | "sector" | "source">) {
  return CONCORSI_TYPES.includes(classifyJob(job));
}
