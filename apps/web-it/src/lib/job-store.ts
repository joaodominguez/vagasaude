import { createHash } from "node:crypto";
import {
  createJobRepository,
  type JobRepository,
  type JobsFile as StoredJobsFile,
} from "@/lib/job-repository";
import { CONTRACT_UNKNOWN } from "@/lib/contracts";
import { normalizeInlineLists } from "@/lib/format-job-text";
import { shortenJobTitle, tidyTitleEnd } from "@/lib/shorten-job-title";

export type StoredJob = {
  id: string;
  slug: string;
  title: string;
  company: string;
  locationDistrict: string;
  locationConcelho: string | null;
  profession: string;
  specialty: string | null;
  sector: "pubblico" | "privato" | "accreditato";
  contractType: string | null;
  description: string;
  requirements: string | null;
  salary: string | null;
  applicationUrl: string;
  source: string;
  sourceId: string;
  dedupeHash: string;
  status: "published" | "pending_review" | "hidden" | "expired" | "duplicate";
  reviewReason: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  /** Ultima volta in cui lo scraper della fonte ha restituito questa offerta. */
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobCardData = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Pubblico" | "Privato" | "Accreditato";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
  /** Quando l'offerta è entrata nel sito (createdAt). Base degli avvisi: molte fonti indicano solo il giorno. */
  firstSeenAt?: string;
  source?: string;
  sourceId?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationUrl: string;
  salary?: string | null;
  featured?: boolean;
};

type JobsFile = StoredJobsFile<StoredJob>;

const SECTOR_LABEL: Record<StoredJob["sector"], JobCardData["sector"]> = {
  pubblico: "Pubblico",
  privato: "Privato",
  accreditato: "Accreditato",
};

// Dove sono salvate le offerte (jobs.json / jobs.db: vedi job-repository.ts e JOB_STORE).
let jobRepository: JobRepository<StoredJob> | null = null;

function repo() {
  jobRepository ??= createJobRepository<StoredJob>();
  return jobRepository;
}

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompany(company: string) {
  const raw = normalize(company);
  // Alias di gruppi privati noti (prima della pulizia generica).
  const groups: Array<[string[], string]> = [
    [["humanitas"], "humanitas"],
    [["gruppo san donato", "gsd", "ospedale san raffaele", "irccs san raffaele"], "gruppo san donato"],
    [["gvm care", "gvm"], "gvm"],
    [["korian", "clariane"], "korian"],
    [["kos care", "kos spa"], "kos"],
    [["synlab"], "synlab"],
    [["unilabs"], "unilabs"],
    [["fresenius"], "fresenius"],
    [["diaverum"], "diaverum"],
    [["affidea"], "affidea"],
  ];
  for (const [needles, canonical] of groups) {
    if (needles.some((needle) => raw.includes(needle))) return canonical;
  }
  return raw
    .replace(/\b(ospedale|clinica|casa di cura|gruppo|centro|istituto|fondazione|azienda|ente)\b/g, " ")
    .replace(/\b(s r l|srl|s p a|spa|s a s|sas|s n c|snc|s c a r l|scarl|soc coop|onlus|ets)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeDedupeHash(title: string, company: string, district: string) {
  return createHash("sha256")
    .update(
      `${normalize(title)}|${normalizeCompany(company)}|${normalize(district)}`,
    )
    .digest("hex");
}

/** Veterinaria ha una landing propria. */
function isVeterinaryTitle(title: string) {
  return normalize(title).includes("veterin");
}

// Mantenere sincronizzato con scrapers-it/common/normalize.py (RULES, OTHER_HINTS).
// Vince il primo gruppo che corrisponde: l'ordine conta.
const PROFESSION_RULES: Array<[RegExp, string]> = [
  [
    new RegExp(
      "\\bformator|\\bdocent|\\btutor didattic|e learning|\\belearning|responsabile (della )?formazione|coordinatore (della )?formazione|\\bistruttore|formazione clinica",
    ),
    "Formazione",
  ],
  [
    new RegExp(
      "informatore (scientifico|medico|farmaceutico)|visitatore medico|medical science liaison|\\bmsl\\b|key account|\\bsales\\b|business development|account manager|product specialist|agente di commercio|\\bcommerciale\\b",
    ),
    "Altro",
  ],
  [
    new RegExp(
      "\\botticc?o\\b|optometr|ottico optometrista|audioprotesist|audiometrist|tecnico audiometrista|tecnico audioprotesista",
    ),
    "Ottica e audiometria",
  ],
  [
    new RegExp(
      "farmacist|farmacia|farmaceutic|pharmacist|parafarmacia",
    ),
    "Farmacia",
  ],
  [
    new RegExp(
      "odontoiatr|dentista|odontostomatolog|ortodonzi|igienista dentale|assistente (alla poltrona|di studio odontoiatrico)|odontotecnic|\\bdental\\b",
    ),
    "Odontoiatria",
  ],
  [
    new RegExp(
      "\\boss\\b|operatore socio ?sanitari|operatrice socio ?sanitari|\\boperatori socio ?sanitari|\\bsocio ?sanitari[oa]\\b|ausiliario socio|\\basa\\b|addett[oa] all assistenza|assistente geriatric|assistente di base|assistenza domiciliare|\\bgeriatric[oa] assistente|\\bossa\\b",
    ),
    "OSS",
  ],
  [
    new RegExp(
      "infermier|\\bcaposala\\b|\\bnurse\\b|\\bnursing\\b|puericultric|assistente sanitari",
    ),
    "Infermieristica",
  ],
  [
    new RegExp(
      "logoped|terapista occupazional|terapista della neuro|neuropsicomotric|psicomotricist|tecnico della riabilitazione|riabilitazione psichiatrica|ortottist|audiologo",
    ),
    "Logopedia e riabilitazione",
  ],
  [
    new RegExp(
      "tecnico sanitario|tecnico di laboratorio|tecnico di radiologia|\\btsrm\\b|\\btslb\\b|tecnico di neurofisiopatologia|tecnico della prevenzione|tecnico ortopedico|fisiopatologia cardiocircolatoria|perfusionist|tecnico di anatomia|tecnico di emodialisi|tecnico sanitario di|podolog|tecnico (di|in) laboratorio|tecnico di imaging|tecnico di diagnostica|tecnico di cardiologia|tecnico di radiodiagnostica|tecnico (di )?elettromedical|dosimetrist|fisico medico",
    ),
    "Tecnici sanitari",
  ],
  [
    new RegExp(
      "nutrizionist|\\bdietist|dietolog|nutrizione|\\bdietetic",
    ),
    "Nutrizione e dietistica",
  ],
  [
    new RegExp(
      "fisioterap|physiotherap|osteopat|massofisioterap|chinesiolog|posturolog",
    ),
    "Fisioterapia",
  ],
  [
    new RegExp(
      "psicolog|psicoterapeut|psychologist|neuropsicolog",
    ),
    "Psicologia",
  ],
  [
    new RegExp(
      "assistente sociale|servizio sociale|servizi sociali|operatore sociale|\\beducator|pedagogist|mediatore culturale|mediatrice culturale|case manager sociale",
    ),
    "Servizio sociale",
  ],
  [
    new RegExp(
      "\\bmedico\\b|\\bmedica\\b|\\bmedici\\b|dirigente medico|\\bmedicina\\b|chirurg|pediatr|anestesi|rianimator|dermatolog|ortopedic|traumatolog|urolog|oculist|oftalmolog|psichiatr|radiolog|geriatra|internista|ginecolog|neurolog|cardiolog|patolog|\\bphysician\\b|guardia medica|specializzand|specialista ambulatoriale|oncolog|ematolog|nefrolog|pneumolog|otorino|endocrinolog|reumatolog|gastroenterolog|diabetolog|neonatolog|fisiatra|infettivolog|allergolog|medico legale|anatomopatolog|neurochirurg|cure palliative|direttore sanitario|emergenza urgenza|medicina generale|\\bdoctor\\b",
    ),
    "Medicina",
  ],
  [
    new RegExp(
      "ostetric|levatrice|\\bmidwife\\b",
    ),
    "Ostetricia",
  ],
  [
    new RegExp(
      "radiologia|radiodiagnostic|laboratorio|laboratory|diagnostica per immagini|analisi cliniche|anatomia patologica|biolog|biochim|microbiolog|biomedic|\\bchimico\\b|elettromedical",
    ),
    "Tecnici sanitari",
  ],
  [
    new RegExp(
      "coordinator|direttore|direttrice|vice ?direttore|\\bgestore\\b|\\bgestori\\b|\\bgestione\\b|\\bcapo\\b|\\bresponsabile\\b|risorse umane|\\bhr\\b|\\bqualita\\b|compliance|logistic|magazzin|\\bacquisti\\b|\\bprocurement\\b|manutenzion|finanziari|contabil|controller|\\bpulizi|cuoco|cuoca|cucina|sicurezza|supervisor|\\bmanager\\b",
    ),
    "Gestione e supporto",
  ],
  [
    new RegExp(
      "amministrativ|\\breception|\\bsegretari|customer care|servizio clienti|contact center|call center|centralinista|\\baccettazione\\b|\\bcup\\b|prenotazion|front office|back office|\\bimpiegat|addett[oa] (alla )?segreteria|documentazione clinica|\\bdata entry\\b|coadiutore amministrativo|assistente amministrativo|dirigente amministrativo",
    ),
    "Amministrativo",
  ],
];

const OTHER_HINTS = ["autista", "conducente", "helpdesk", "informatic", "sistemista", "data analyst", "ingegner", "ricercator", "postdoc", "researcher", "sviluppator", "developer", "elettricista", "idraulico", "giardiniere", "manutentore"];

export function guessProfession(title: string, fallback = "Altro"): string {
  // "Infermiere/a", "Educatore/trice" -> senza il suffisso di genere.
  const t = normalize(title.replace(/\s*\/\s*(?:a|e|i|ice|trice|essa|o)\b/gi, ""));
  if (t.includes("veterin")) return "Veterinaria";
  // Solo titoli che iniziano con "Formazione ..." (non il testo della descrizione).
  if (t.length < 70 && t.startsWith("formazione ")) return "Formazione";
  for (const [pattern, label] of PROFESSION_RULES) {
    if (pattern.test(t)) return label;
  }
  if (OTHER_HINTS.some((needle) => t.includes(needle))) return "Altro";
  return fallback;
}


export function slugify(text: string) {
  return normalize(text).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export function buildJobSlug(title: string, company: string, sourceId: string) {
  const base = `${slugify(title)}-${slugify(company)}-${slugify(sourceId)}`
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.slice(0, 100);
}

function slugNeedsRepair(slug: string) {
  // Barras/espacos partem a rota /offerte/[slug].
  return !slug || /[\/\\?#%\s]/.test(slug);
}

function publishedLabel(value: string | null) {
  if (!value) return "Recente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recente";
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  if (diffDays < 7) return `${diffDays} giorni fa`;
  return date.toLocaleDateString("it-IT");
}

function isListItem(line: string) {
  return /^[-•*]\s+\S/.test(line) || /^\d+[.)]\s+\S/.test(line);
}

function cleanDescription(text: string) {
  const lines = normalizeInlineLists(text)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => {
      if (!line) return true;
      if (line.startsWith(".") || line.includes("{") || line.includes("}")) {
        return false;
      }
      if (/^a document with/i.test(line)) return false;
      return true;
    });

  const compacted: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      const prev = [...compacted].reverse().find((l) => l !== "") ?? "";
      const next = lines.slice(i + 1).find((l) => l !== "") ?? "";
      if (!prev || !next) continue;
      // Elenchi compatti; nessuna riga vuota tra titolo/introduzione e l'elenco.
      if (isListItem(prev) && isListItem(next)) continue;
      if (!isListItem(prev) && isListItem(next)) continue;
      if (compacted[compacted.length - 1] === "") continue;
      compacted.push("");
      continue;
    }
    compacted.push(line);
  }

  return compacted.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitList(text: string | null): string[] {
  if (!text) return [];
  return cleanDescription(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 8);
}

const DAY_MS = 86_400_000;
/** Offerta pubblicata da oltre 1 anno senza scadenza futura: considerata chiusa. */
const MAX_JOB_AGE_DAYS = 365;
/** Fonte che non restituisce l'offerta da 7 giorni (~28 esecuzioni fallite): considerata chiusa. */
const MAX_UNSEEN_DAYS = 7;

/** "Publicado em 16/02/2023 15h15" (INCA) e outros dd/mm/aaaa. */
function parseLooseDate(value: string | null | undefined) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(t) ? null : t;
}

/**
 * Data di pubblicazione reale: quella della fonte se valida e non futura; altrimenti la
 * prima volta in cui abbiamo visto l'offerta (createdAt). Mai l'ora della richiesta.
 */
export function normalizePublishedAt(
  value: string | null | undefined,
  firstSeen: string,
) {
  const t = parseLooseDate(value);
  if (t == null || t > Date.now()) return firstSeen;
  return value && !Number.isNaN(Date.parse(value)) ? value : new Date(t).toISOString();
}

function isPastExpiry(job: StoredJob) {
  if (!job.expiresAt) return false;
  const expires = Date.parse(job.expiresAt);
  return !Number.isNaN(expires) && expires < Date.now();
}

function hasFutureExpiry(job: StoredJob) {
  if (!job.expiresAt) return false;
  const expires = Date.parse(job.expiresAt);
  return !Number.isNaN(expires) && expires >= Date.now();
}

/** Offerta pubblicata che non va più servita come attiva (elenchi, sitemap, JobPosting). */
function isInactive(job: StoredJob) {
  return isClosedNoticeTitle(job.title) || isInactiveByDate(job);
}

/** La parte di isInactive che dipende dall'ora (scadenza, ultima volta vista, età). */
function isInactiveByDate(job: StoredJob) {
  const now = Date.now();
  const lastSeen = Date.parse(job.lastSeenAt || job.updatedAt || "");
  // Scadenza della fonte passata, ma la fonte pubblica ancora l'offerta (vista da <2 giorni):
  // resta attiva; il validThrough diventa ultima volta vista + 30 giorni.
  const seenRecently = !Number.isNaN(lastSeen) && now - lastSeen < 2 * DAY_MS;
  if (isPastExpiry(job) && !seenRecently) return true;
  if (!Number.isNaN(lastSeen) && now - lastSeen > MAX_UNSEEN_DAYS * DAY_MS) {
    return true;
  }
  if (hasFutureExpiry(job)) return false;
  const published = parseLooseDate(normalizePublishedAt(job.publishedAt, job.createdAt));
  return published != null && now - published > MAX_JOB_AGE_DAYS * DAY_MS;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/**
 * Alcune fonti inviano titoli con entità HTML codificate due volte
 * ("Infermiere &amp;egrave;", "&#128226; NUOVO"). Decodifica fino a 2 livelli.
 */
export function decodeHtmlEntities(text: string) {
  let out = text;
  for (let pass = 0; pass < 2 && /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(out); pass += 1) {
    out = out.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const n = code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    });
  }
  return out;
}

/** Titoli senza emoji/pittogrammi (📢, 🤝, 📍). */
function cleanTitleText(text: string) {
  return decodeHtmlEntities(text)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function toJobCard(job: StoredJob): JobCardData {
  const description = cleanDescription(job.description);
  const requirements = splitList(job.requirements);
  const descriptionLines = splitList(description);
  // Con requisiti reali, "Mansioni" usa solo il 1° blocco della
  // descrizione (profilo), per non mischiarsi con "Condizioni offerte".
  const profileBlock = description.split(/\n\n+/)[0] || description;
  const responsibilitySource =
    requirements.length > 0 ? splitList(profileBlock) : descriptionLines;
  return {
    slug: job.slug,
    // Anche in lettura: le offerte acquisite prima della correzione hanno ancora entità come "&#243;".
    title: tidyTitleEnd(cleanTitleText(job.title)),
    company: decodeHtmlEntities(job.company),
    district: job.locationDistrict,
    city: job.locationConcelho || job.locationDistrict,
    sector: SECTOR_LABEL[job.sector],
    contract: job.contractType || CONTRACT_UNKNOWN,
    profession: isVeterinaryTitle(job.title) ? "Veterinaria" : job.profession,
    publishedLabel: publishedLabel(normalizePublishedAt(job.publishedAt, job.createdAt)),
    publishedAt: normalizePublishedAt(job.publishedAt, job.createdAt),
    firstSeenAt: job.createdAt,
    expiresAt: job.expiresAt,
    lastSeenAt: job.lastSeenAt || job.updatedAt,
    source: job.source,
    sourceId: job.sourceId,
    description,
    requirements:
      requirements.length > 0
        ? requirements
        : descriptionLines.slice(0, 4).length > 0
          ? descriptionLines.slice(0, 4)
          : ["Consulta i dettagli e candidati sul sito dell'ente."],
    responsibilities:
      responsibilitySource.slice(0, 5).length > 0
        ? responsibilitySource.slice(0, 5)
        : ["Consulta la descrizione completa sulla pagina dell'ente."],
    applicationUrl: job.applicationUrl,
    salary: job.salary,
  };
}

// Cache in memoria del file (2,5 MB+) per non rileggerlo/parsarlo a ogni richiesta.
// Si invalida da sola quando cambia l'mtime di jobs.json (scrape/admin).
let jobsCache: { mtimeMs: number; file: JobsFile } | null = null;

// Card + indice per slug derivati dal file. Evita toJobCard×N e scansioni lineari
// a ogni SSR (dettaglio/home/elenco). Il soft-TTL aggiorna publishedLabel ("Oggi").
const CARDS_TTL_MS = 60_000;
type DerivedJobsCache = {
  mtimeMs: number;
  builtAt: number;
  /** Pubblicate senza titolo di avviso di chiusura (non dipende dall'ora). */
  candidates: StoredJob[];
  /** Attive quando la cache è stata costruita (dipende dall'ora: scadenze, viste da >7 giorni). */
  active: StoredJob[];
  cards: JobCardData[];
  bySlug: Map<string, StoredJob>;
  /** Ripubblicazioni: slug della copia → slug dell'offerta principale. */
  canonicalOf: Map<string, string>;
  /** Varianti del nome del datore di lavoro → nome da mostrare. */
  companyNames: Map<string, string>;
};
let derivedJobsCache: DerivedJobsCache | null = null;

function clearDerivedJobsCache() {
  derivedJobsCache = null;
}

/**
 * Coda per leggi-modifica-scrivi su jobs.json: due ingest simultanei leggevano la
 * stessa versione e il secondo a scrivere cancellava le modifiche del primo.
 */
let jobsFileQueue: Promise<unknown> = Promise.resolve();

function withJobsFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = jobsFileQueue.then(task, task);
  jobsFileQueue = run.catch(() => undefined);
  return run;
}

/** N. di offerte dell'ultima versione letta/scritta (per la protezione di writeJobsFile). */
let knownJobsCount = 0;

async function readJobsFile(): Promise<JobsFile> {
  try {
    const mtimeMs = await repo().version();
    if (jobsCache && jobsCache.mtimeMs === mtimeMs) {
      return jobsCache.file;
    }
    const parsed = await repo().load();
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    knownJobsCount = jobs.length;
    const repaired = repairJobSlugs(jobs);
    const file: JobsFile = {
      updatedAt: parsed.updatedAt,
      jobs: repaired.jobs,
    };
    if (repaired.changed) {
      file.updatedAt = new Date().toISOString();
      await writeJobsFile(file);
      return file;
    }
    jobsCache = { mtimeMs, file };
    clearDerivedJobsCache();
    return file;
  } catch (error) {
    // Il file non esiste ancora (prima esecuzione): base vuota.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { updatedAt: new Date(0).toISOString(), jobs: [] };
    }
    // Illeggibile (es. letto a metà di una scrittura): mai restituire vuoto, altrimenti
    // l'ingest successivo scriverebbe sopra e cancellerebbe lo storico.
    if (jobsCache) return jobsCache.file;
    throw new Error(`jobs.json illeggibile: ${(error as Error).message}`);
  }
}

function sameJobs(a: StoredJob[], b: StoredJob[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Aggiorna le etichette relative ("Oggi", "3 giorni fa") con il passare del tempo. Un'offerta che
 * aveva già 7+ giorni quando le etichette sono state calcolate (labelsAt) mostra la data fissa, che
 * non cambia più: si ricalcolano solo le altre. Restituisce lo stesso elenco se nulla è cambiato.
 */
function refreshPublishedLabels(cards: JobCardData[], labelsAt: number) {
  let next: JobCardData[] | null = null;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const time = Date.parse(card.publishedAt);
    if (!Number.isNaN(time) && labelsAt - time >= 7 * DAY_MS) continue;
    const label = publishedLabel(card.publishedAt);
    if (label === card.publishedLabel) continue;
    next ??= cards.slice();
    next[i] = { ...card, publishedLabel: label };
  }
  return next ?? cards;
}

async function getDerivedJobsCache(): Promise<DerivedJobsCache> {
  const file = await readJobsFile();
  const mtimeMs = jobsCache?.mtimeMs ?? 0;
  const now = Date.now();
  if (derivedJobsCache && derivedJobsCache.mtimeMs === mtimeMs) {
    if (now - derivedJobsCache.builtAt < CARDS_TTL_MS) return derivedJobsCache;
    // Stessi dati, è solo passato del tempo. Se le offerte attive sono le stesse, basta aggiornare le
    // etichette "Oggi"/"Ieri" (millisecondi) invece di ricostruire tutto: la ricostruzione
    // bloccava l'app e rallentava i click ogni 60 s.
    const active = derivedJobsCache.candidates.filter((job) => !isInactiveByDate(job));
    if (sameJobs(active, derivedJobsCache.active)) {
      derivedJobsCache = {
        ...derivedJobsCache,
        builtAt: now,
        cards: refreshPublishedLabels(derivedJobsCache.cards, derivedJobsCache.builtAt),
      };
      return derivedJobsCache;
    }
  }

  const bySlug = new Map<string, StoredJob>();
  for (const job of file.jobs) {
    bySlug.set(job.slug, job);
    const normalized = slugify(job.slug);
    if (normalized && normalized !== job.slug && !bySlug.has(normalized)) {
      bySlug.set(normalized, job);
    }
  }

  const candidates = file.jobs.filter(
    (job) => job.status === "published" && !isClosedNoticeTitle(job.title),
  );
  const active = candidates.filter((job) => !isInactiveByDate(job));
  const canonicalOf = findRepostings(active);
  const listed = active
    .filter((job) => !canonicalOf.has(job.slug))
    .map(toJobCard);
  const companyNames = buildCompanyDisplayNames(listed.map((card) => card.company));
  const cards = listed
    .map((card) => {
      const company = companyNames.get(card.company);
      return company ? { ...card, company } : card;
    })
    .sort((a, b) => {
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "it");
    });

  derivedJobsCache = {
    mtimeMs,
    builtAt: now,
    candidates,
    active,
    cards,
    bySlug,
    canonicalOf,
    companyNames,
  };
  return derivedJobsCache;
}

/** Suffissi legali e parole generiche ignorati quando si uniscono le varianti del nome del datore di lavoro. */
const COMPANY_NAME_NOISE =
  /\b(s r l|srl|s p a|spa|s a s|sas|s n c|snc|s c a r l|scarl|soc coop|societa cooperativa|societa cooperativa sociale|onlus|ets|gruppo|group|italia|italy)\b/g;

function companyNameKey(name: string) {
  return normalize(name).replace(COMPANY_NAME_NOISE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Varianti dello stesso datore di lavoro ("ESEMPIO S.R.L." / "Esempio Srl",
 * "ASL …, ASL" / "Azienda USL …") → un solo nome di presentazione: il più usato,
 * preferendo quello non tutto maiuscolo. Restituisce nome originale → nome da mostrare.
 */
function buildCompanyDisplayNames(companies: string[]) {
  const counts = new Map<string, number>();
  for (const name of companies) counts.set(name, (counts.get(name) ?? 0) + 1);
  const rank = (name: string) =>
    (name !== name.toUpperCase() ? 1_000_000 : 0) + (counts.get(name) ?? 0);
  const best = new Map<string, string>();
  for (const name of counts.keys()) {
    const key = companyNameKey(name);
    if (!key) continue;
    const current = best.get(key);
    if (!current || rank(name) > rank(current)) best.set(key, name);
  }
  const display = new Map<string, string>();
  for (const name of counts.keys()) {
    const preferred = best.get(companyNameKey(name));
    if (preferred && preferred !== name) display.set(name, preferred);
  }
  return display;
}

/**
 * Ripubblicazioni della stessa offerta (stesso titolo, ente, sede e descrizione, ID
 * diversi nella fonte). Resta la più vecchia; le altre escono da elenchi/sitemap e
 * puntano il canonical ad essa. Restituisce slug della copia → slug della principale.
 */
function findRepostings(active: StoredJob[]) {
  const groups = new Map<string, StoredJob[]>();
  for (const job of active) {
    const key = [
      normalize(job.title),
      normalize(job.company),
      normalize(job.locationConcelho || job.locationDistrict),
      normalize(job.description).slice(0, 400),
    ].join("|");
    const list = groups.get(key);
    if (list) list.push(job);
    else groups.set(key, [job]);
  }
  const canonicalOf = new Map<string, string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = list
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.slug.localeCompare(b.slug));
    for (const copy of sorted.slice(1)) canonicalOf.set(copy.slug, sorted[0].slug);
  }
  return canonicalOf;
}

function repairJobSlugs(jobs: StoredJob[]) {
  let changed = false;
  const next = jobs.map((job) => {
    if (!slugNeedsRepair(job.slug)) return job;
    changed = true;
    return {
      ...job,
      slug: buildJobSlug(job.title, job.company, job.sourceId),
      updatedAt: new Date().toISOString(),
    };
  });
  return { jobs: next, changed };
}

async function writeJobsFile(file: JobsFile) {
  // Una scrittura che lascia meno della metà delle offerte è quasi certamente un bug
  // (es. base letta come vuota): rifiutare invece di cancellare lo storico.
  if (knownJobsCount >= 100 && file.jobs.length < knownJobsCount / 2) {
    throw new Error(
      `Scrittura di jobs.json rifiutata: si passerebbe da ${knownJobsCount} a ${file.jobs.length} offerte.`,
    );
  }
  // Copia giornaliera + scrittura atomica (vedi job-repository.ts).
  await repo().save(file);
  knownJobsCount = file.jobs.length;
  // Mantenere la cache coerente dopo la scrittura (ingest/reclassify/repair).
  try {
    jobsCache = { mtimeMs: await repo().version(), file };
  } catch {
    jobsCache = null;
  }
  clearDerivedJobsCache();
}

export async function listAllStoredJobs() {
  const file = await readJobsFile();
  return file.jobs
    .slice()
    .sort((a, b) => {
      const aDate = a.updatedAt || a.publishedAt || a.createdAt;
      const bDate = b.updatedAt || b.publishedAt || b.createdAt;
      return bDate.localeCompare(aDate);
    });
}

/** Admin (sola lettura): record completo per id, in qualsiasi stato, e le altre voci
 * con lo stesso dedupeHash (la stessa offerta in altre fonti / duplicati). */
export async function getStoredJobById(id: string) {
  const file = await readJobsFile();
  const job = file.jobs.find((item) => item.id === id);
  if (!job) return null;
  const sameHash = file.jobs.filter(
    (item) => item.dedupeHash === job.dedupeHash && item.id !== job.id,
  );
  return { job, sameHash };
}

export async function listStoredJobs(status: StoredJob["status"] = "published") {
  const jobs = await listAllStoredJobs();
  return jobs.filter((job) => job.status === status);
}

function lookupStoredJob(
  bySlug: Map<string, StoredJob>,
  slug: string,
): StoredJob | null {
  const direct = bySlug.get(slug);
  if (direct) return direct;
  const normalized = slugify(slug);
  if (!normalized) return null;
  return bySlug.get(normalized) ?? null;
}

export async function getStoredJobBySlug(slug: string) {
  const { bySlug } = await getDerivedJobsCache();
  const match = lookupStoredJob(bySlug, slug);
  if (!match || match.status !== "published") return null;
  return match;
}

export async function getStoredJobBySlugIncludingExpired(slug: string) {
  const { bySlug } = await getDerivedJobsCache();
  const match = lookupStoredJob(bySlug, slug);
  if (!match) return null;

  if (match.status === "published") {
    if (isInactive(match)) {
      return { job: match, expired: true as const };
    }
    return { job: match, expired: false as const };
  }
  if (match.status === "expired" || isInactive(match)) {
    return { job: match, expired: true as const };
  }
  return null;
}

export async function listJobCards() {
  const { cards } = await getDerivedJobsCache();
  return cards;
}

function isClosedNoticeTitle(title: string) {
  const t = normalize(title);
  return (
    // Avvisi di esito/procedura, non offerte: graduatorie finali, ammessi, calendari prove, revoche.
    t.includes("graduatoria finale") ||
    t.includes("approvazione della graduatoria") ||
    t.includes("approvazione graduatoria") ||
    t.includes("elenco degli ammessi") ||
    t.includes("elenco ammessi") ||
    t.includes("elenco dei candidati") ||
    t.includes("calendario delle prove") ||
    t.includes("diario delle prove") ||
    t.includes("esito della selezione") ||
    t.includes("esito selezione") ||
    t.includes("rettifica del bando") ||
    t.startsWith("revoca ") ||
    t.startsWith("avviso di rettifica") ||
    t.startsWith("comunicazione ") ||
    // Titolo troncato dall'accorciatore (es. "(306 (306 posti)").
    /^\(\d/.test(title.trim()) ||
    // Fuori ambito: assistenza clienti in altre lingue.
    /\bassistenza clienti\b|\bin (?:italiano|tedesco|francese)\b/.test(t)
  );
}

export async function getJobCard(slug: string) {
  const found = await getStoredJobBySlugIncludingExpired(slug);
  if (!found) return null;
  const { canonicalOf, companyNames } = await getDerivedJobsCache();
  const card = toJobCard(found.job);
  const company = companyNames.get(card.company);
  return {
    job: company ? { ...card, company } : card,
    expired: found.expired,
    canonicalSlug: found.expired ? undefined : canonicalOf.get(found.job.slug),
  };
}

export type IngestJobInput = {
  title: string;
  company: string;
  location_district: string;
  location_concelho?: string | null;
  profession: string;
  specialty?: string | null;
  sector: "pubblico" | "privato" | "accreditato";
  contract_type?: string | null;
  description: string;
  requirements?: string | null;
  salary?: string | null;
  application_url: string;
  source: string;
  source_id: string;
  published_at?: string | null;
  expires_at?: string | null;
  status?: StoredJob["status"];
  review_reason?: string | null;
};

/**
 * Alcune fonti forniscono solo un estratto (~250 caratteri); la descrizione completa
 * arriva dalla pagina di dettaglio, acquisita a parte. Un estratto breve non sostituisce
 * una descrizione più completa della stessa offerta.
 */
function keepFullerDescription(existing: StoredJob | undefined, incoming: string) {
  const current = existing?.description || "";
  if (current.length <= incoming.length || incoming.length >= 400) return incoming;
  const head = normalize(incoming.replace(/(?:\.\.\.|…)\s*$/, "")).slice(0, 60);
  const sameText = Boolean(head) && normalize(current).includes(head);
  return sameText || existing?.source === "net_empregos" ? current : incoming;
}

/** Aggregatori: perdono contro la stessa offerta pubblicata dal datore di lavoro stesso. */
const AGGREGATOR_SOURCES = new Set<string>([
  // Portali generalisti / aggregatori (id di fonte): se il datore di lavoro pubblica la stessa
  // offerta direttamente, la sua diventa principale e la copia resta come duplicato.
  // TODO: popolare quando saranno decise le fonti italiane.
]);

export function ingestJobs(...args: Parameters<typeof ingestJobsUnlocked>) {
  return withJobsFileLock(() => ingestJobsUnlocked(...args));
}

export type IngestOptions = {
  /** false: lo scraper sa che il lotto è incompleto (non far scadere le assenti). */
  expireMissing?: boolean;
  /** L'elenco è completo anche se piccolo (fa scadere le assenti con qualsiasi lotto > 0). */
  authoritative?: boolean;
};

async function ingestJobsUnlocked(
  source: string,
  incoming: IngestJobInput[],
  options: IngestOptions = {},
) {
  const file = await readJobsFile();
  const now = new Date().toISOString();
  const bySourceId = new Map(
    file.jobs
      .filter((job) => job.source === source)
      .map((job) => [`${job.source}:${job.sourceId}`, job] as const),
  );
  const byHash = new Map(file.jobs.map((job) => [job.dedupeHash, job] as const));
  // Offerte attive pubblicate dal datore di lavoro stesso (non aggregatore), per hash.
  const employerHashes = new Set(
    file.jobs
      .filter(
        (job) =>
          !AGGREGATOR_SOURCES.has(job.source) &&
          (job.status === "published" || job.status === "pending_review"),
      )
      .map((job) => job.dedupeHash),
  );

  let created = 0;
  let updated = 0;
  let ignored = 0;
  let review = 0;

  for (const item of incoming) {
    const title = shortenJobTitle(cleanTitleText(item.title || ""));
    const company = decodeHtmlEntities(item.company || "").trim();
    const district = item.location_district?.trim();
    const applicationUrl = item.application_url?.trim();
    const sourceId = String(item.source_id || "").trim();

    if (!title || !company || !district || !applicationUrl || !sourceId) {
      ignored += 1;
      continue;
    }

    const dedupeHash = makeDedupeHash(title, company, district);
    const existingSameSource = bySourceId.get(`${source}:${sourceId}`);
    const existingHash = byHash.get(dedupeHash);
    const description = keepFullerDescription(
      existingSameSource,
      cleanDescription(decodeHtmlEntities(item.description || "").trim() || title),
    );
    const profession = isVeterinaryTitle(title)
      ? "Veterinaria"
      : !item.profession?.trim() || item.profession.trim() === "Altro"
        ? guessProfession(title, item.profession?.trim() || "Altro")
        : item.profession.trim();
    const incomplete = !description || description.length < 40 || !profession;

    let status: StoredJob["status"] =
      item.status || (incomplete ? "pending_review" : "published");
    let reviewReason = item.review_reason || null;

    if (!existingSameSource && existingHash) {
      const hashIsLive =
        existingHash.status === "published" ||
        existingHash.status === "pending_review";
      if (
        existingHash.source !== source &&
        hashIsLive &&
        AGGREGATOR_SOURCES.has(existingHash.source) &&
        !AGGREGATOR_SOURCES.has(source)
      ) {
        // L'offerta esisteva tramite aggregatore; quella del datore di lavoro (descrizione completa,
        // candidatura diretta) diventa la principale e la copia resta duplicata.
        existingHash.status = "duplicate";
        existingHash.reviewReason = `Duplicato di ${source}:${sourceId}`;
        existingHash.updatedAt = now;
      } else if (existingHash.source !== source && hashIsLive) {
        status = "duplicate";
        reviewReason = `Duplicato di ${existingHash.source}:${existingHash.sourceId}`;
      } else if (
        existingHash.source === source &&
        existingHash.sourceId !== sourceId &&
        hashIsLive
      ) {
        // Stessa fonte, stesso titolo/azienda/regione, ID di origine diversi
        // (es. la fonte ripubblica la stessa offerta con un altro sourceId).
        status = "duplicate";
        reviewReason = `Duplicato interno di ${existingHash.source}:${existingHash.sourceId}`;
      }
    }

    if (
      AGGREGATOR_SOURCES.has(source) &&
      status !== "duplicate" &&
      employerHashes.has(dedupeHash)
    ) {
      // Copia di aggregatore di un'offerta che il datore di lavoro pubblica direttamente.
      status = "duplicate";
      reviewReason = "Duplicato di offerta pubblicata direttamente dal datore di lavoro";
    }

    if (status === "pending_review") review += 1;

    const slugBase = buildJobSlug(title, company, sourceId);
    const existingSlug = existingSameSource?.slug;
    const slug =
      existingSlug && !slugNeedsRepair(existingSlug) ? existingSlug : slugBase;
    const next: StoredJob = {
      id: existingSameSource?.id || crypto.randomUUID(),
      slug,
      title,
      company,
      locationDistrict: district,
      locationConcelho: item.location_concelho?.trim() || null,
      profession,
      specialty: item.specialty?.trim() || null,
      sector: item.sector,
      contractType: item.contract_type?.trim() || null,
      description,
      requirements: item.requirements
        ? decodeHtmlEntities(item.requirements).trim() || null
        : null,
      salary: item.salary?.trim() || null,
      applicationUrl,
      source,
      sourceId,
      dedupeHash,
      status,
      reviewReason,
      publishedAt: normalizePublishedAt(
        item.published_at || existingSameSource?.publishedAt,
        existingSameSource?.createdAt || now,
      ),
      expiresAt: item.expires_at || null,
      lastSeenAt: now,
      createdAt: existingSameSource?.createdAt || now,
      updatedAt: now,
    };

    if (existingSameSource) {
      const index = file.jobs.findIndex((job) => job.id === existingSameSource.id);
      file.jobs[index] = next;
      updated += 1;
    } else {
      file.jobs.push(next);
      created += 1;
      bySourceId.set(`${source}:${sourceId}`, next);
      byHash.set(dedupeHash, next);
    }
  }

  // Soft-expire jobs from this source that disappeared from the latest scrape.
  // Non con lotti parziali: una fonte che restituisce poche offerte invece di centinaia
  // non deve far scadere tutte le altre. Scade solo con un lotto di almeno la metà di quanto
  // pubblicato (o se lo scraper dichiara l'elenco completo) e mai con 0 offerte.
  const existingPublished = file.jobs.filter(
    (job) => job.source === source && job.status === "published",
  ).length;
  const shouldExpireMissing =
    options.expireMissing !== false &&
    incoming.length > 0 &&
    (options.authoritative === true ||
      incoming.length >= Math.floor(existingPublished * 0.5));
  // Con lotto parziale, un'offerta che non compare da più di 3 giorni scade comunque
  // (se la fonte si riduce davvero, le vecchie non restano pubblicate per sempre).
  const staleBefore = Date.now() - 3 * 24 * 3600 * 1000;
  if (incoming.length > 0) {
    const seen = new Set(incoming.map((item) => String(item.source_id)));
    for (const job of file.jobs) {
      if (job.source !== source || job.status !== "published" || seen.has(job.sourceId)) continue;
      const lastSeen = Date.parse(job.lastSeenAt || job.updatedAt || "");
      if (shouldExpireMissing || (!Number.isNaN(lastSeen) && lastSeen < staleBefore)) {
        job.status = "expired";
        job.updatedAt = now;
      }
    }
  }

  file.updatedAt = now;
  await writeJobsFile(file);

  return {
    source,
    created,
    updated,
    ignored,
    review,
    total: file.jobs.filter((job) => job.status === "published").length,
  };
}

export function reclassifyAltroProfessions(...args: Parameters<typeof reclassifyAltroProfessionsUnlocked>) {
  return withJobsFileLock(() => reclassifyAltroProfessionsUnlocked(...args));
}

async function reclassifyAltroProfessionsUnlocked() {
  const file = await readJobsFile();
  let changed = 0;
  const now = new Date().toISOString();
  for (const job of file.jobs) {
    if (job.status !== "published" && job.status !== "pending_review") continue;
    if (isClosedNoticeTitle(job.title) && job.status === "published") {
      job.status = "expired";
      job.updatedAt = now;
      changed += 1;
      continue;
    }
    // Sempre a partire dal titolo, senza ripiego sulla categoria attuale.
    const next = guessProfession(job.title, "Altro");
    if (!next || next === job.profession) continue;
    job.profession = next;
    job.updatedAt = now;
    changed += 1;
  }
  if (changed > 0) {
    file.updatedAt = now;
    await writeJobsFile(file);
  }
  return { changed, total: file.jobs.length };
}

/** Accorcia i titoli burocratici (concorsi pubblici) alla sola funzione. */
export function shortenPublishedJobTitles(...args: Parameters<typeof shortenPublishedJobTitlesUnlocked>) {
  return withJobsFileLock(() => shortenPublishedJobTitlesUnlocked(...args));
}

async function shortenPublishedJobTitlesUnlocked() {
  const file = await readJobsFile();
  let changed = 0;
  const now = new Date().toISOString();
  for (const job of file.jobs) {
    if (job.status !== "published" && job.status !== "pending_review") continue;
    const nextTitle = shortenJobTitle(job.title);
    if (!nextTitle || nextTitle === job.title) continue;
    job.title = nextTitle;
    job.dedupeHash = makeDedupeHash(
      nextTitle,
      job.company,
      job.locationDistrict,
    );
    const nextProfession = guessProfession(nextTitle, job.profession || "Altro");
    if (nextProfession) job.profession = nextProfession;
    job.updatedAt = now;
    changed += 1;
  }
  if (changed > 0) {
    file.updatedAt = now;
    await writeJobsFile(file);
  }
  return { changed, total: file.jobs.length };
}

/** Segna come duplicate le offerte published/pending con lo stesso dedupeHash (mantiene la più vecchia). */
export function collapseDuplicateHashes(...args: Parameters<typeof collapseDuplicateHashesUnlocked>) {
  return withJobsFileLock(() => collapseDuplicateHashesUnlocked(...args));
}

async function collapseDuplicateHashesUnlocked() {
  const file = await readJobsFile();
  const now = new Date().toISOString();
  const groups = new Map<string, StoredJob[]>();
  for (const job of file.jobs) {
    if (job.status !== "published" && job.status !== "pending_review") continue;
    const list = groups.get(job.dedupeHash) || [];
    list.push(job);
    groups.set(job.dedupeHash, list);
  }

  let collapsed = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      const aTime = Date.parse(a.createdAt || a.publishedAt || "") || 0;
      const bTime = Date.parse(b.createdAt || b.publishedAt || "") || 0;
      return aTime - bTime;
    });
    const keep = list[0];
    for (const job of list.slice(1)) {
      job.status = "duplicate";
      job.reviewReason = `Duplicado de ${keep.source}:${keep.sourceId}`;
      job.updatedAt = now;
      collapsed += 1;
    }
  }

  if (collapsed > 0) {
    file.updatedAt = now;
    await writeJobsFile(file);
  }
  return { collapsed, total: file.jobs.length };
}

export async function getJobStats() {
  const file = await readJobsFile();
  const published = file.jobs.filter((job) => job.status === "published");
  const bySource = published.reduce<Record<string, number>>((acc, job) => {
    acc[job.source] = (acc[job.source] || 0) + 1;
    return acc;
  }, {});
  const byStatus = file.jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
  return {
    updatedAt: file.updatedAt,
    total: file.jobs.length,
    published: published.length,
    pendingReview: byStatus.pending_review || 0,
    hidden: byStatus.hidden || 0,
    expired: byStatus.expired || 0,
    duplicate: byStatus.duplicate || 0,
    bySource,
    byStatus,
  };
}
