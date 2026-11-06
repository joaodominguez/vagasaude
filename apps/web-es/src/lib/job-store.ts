import { createHash } from "node:crypto";
import {
  chmod,
  chown,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
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
  sector: "publico" | "privado" | "concertado";
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
  /** Última vez que o scraper da fonte devolveu esta vaga. */
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
  sector: "Público" | "Privado" | "Concertado";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
  lastSeenAt?: string | null;
  /** Cuándo entró la oferta en el sitio (createdAt). Base de las alertas: muchas fuentes solo dan el día. */
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

type JobsFile = {
  updatedAt: string;
  jobs: StoredJob[];
};

const SECTOR_LABEL: Record<StoredJob["sector"], JobCardData["sector"]> = {
  publico: "Público",
  privado: "Privado",
  concertado: "Concertado",
};

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function jobsFilePath() {
  return path.join(dataDir(), "jobs.json");
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
  // Alias de grupos privados conocidos (antes del strip genérico).
  const groups: Array<[string[], string]> = [
    [["quironsalud", "quiron salud", "idc salud"], "quironsalud"],
    [["hm hospitales", "grupo hm", "hm sanchinarro", "hm monteprincipe"], "hm hospitales"],
    [["vithas"], "vithas"],
    [["sanitas"], "sanitas"],
    [["ribera salud", "grupo ribera", "hospital ribera"], "ribera"],
    [["hla grupo", "grupo hla", "clinica hla"], "hla"],
    [["hospiten"], "hospiten"],
    [["viamed"], "viamed"],
    [["ascires"], "ascires"],
    [["fresenius"], "fresenius"],
    [["diaverum"], "diaverum"],
    [["domusvi"], "domusvi"],
    [["amavir"], "amavir"],
    [["emeis", "orpea"], "emeis"],
    [["synlab"], "synlab"],
    [["unilabs"], "unilabs"],
  ];
  for (const [needles, canonical] of groups) {
    if (needles.some((needle) => raw.includes(needle))) return canonical;
  }
  return raw
    .replace(/\b(hospital|clinica|grupo|salud|centro|fundacion)\b/g, " ")
    .replace(/\b(s l u|s l|sl|slu|s a|sa|s a u|sau)\b/g, " ")
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

/** Veterinaria tiene landing propia (antes caía en Medicina/Enfermería). */
function isVeterinaryTitle(title: string) {
  return normalize(title).includes("veterin");
}

export function guessProfession(title: string, fallback = "Otros") {
  // "Técnico/a Superior", "Trabajador/a social" → sin la marca de género.
  const t = normalize(title.replace(/\/(?:a|as|os|o)\b/gi, ""));
  if (t.includes("veterin")) return "Veterinaria";
  // Profesiones sanitarias reguladas: óptico-optometrista y técnico superior en audiología protésica.
  if (/optometr|optico optometrista|audioprotesi|audiologia protesica/.test(t)) return "Óptica y audiología";
  // Solo títulos que empiezan por "Formación …" (no texto de descripción).
  if (t.length < 70 && t.startsWith("formacion ")) return "Formación";
  // Mantener sincronizado con scrapers-es/common/normalize.py (guess_profession).
  // El primer grupo que coincide gana: el orden importa.
  const rules: Array<[string[], string]> = [
    [
      [
        "formador",
        "formadora",
        "docente",
        "tecnico de formacion",
        "responsable de formacion",
        "coordinador de formacion",
        "coordinadora de formacion",
        "instructor",
        "e-learning",
        "elearning",
        "educacion clinica",
      ],
      "Formación",
    ],
    // Comercial/farma antes de Medicina/Farmacia (visitador médico, DIM…).
    [
      [
        "delegado de informacion medica",
        "delegada de informacion medica",
        "informador tecnico",
        "visitador medico",
        "visitadora medica",
        "medical science liaison",
        "msl",
        "key account",
        "comercial",
        "sales",
        "business development",
        "account manager",
        "product specialist",
        "especialista de producto",
      ],
      "Comercial / Farma",
    ],
    [
      [
        "tecnico de farmacia",
        "tecnico en farmacia",
        "tecnica en farmacia",
        "tecnica de farmacia",
        "auxiliar de farmacia",
        "tecnico medio sanitario farmacia",
        "tecnica media sanitaria farmacia",
        "parafarmacia",
      ],
      "Técnico de farmacia",
    ],
    [["farmaceutic", "farmacia", "pharmacist"], "Farmacia"],
    [
      [
        "odontolog",
        "dentista",
        "estomatolog",
        "ortodoncist",
        "higienista dental",
        "auxiliar dental",
        "protesico dental",
      ],
      "Odontología",
    ],
    // TCAE antes de Enfermería ("auxiliar de enfermería" contiene "enfermer").
    [
      [
        "tcae",
        "auxiliar de enfermeria",
        "tecnico en cuidados auxiliares",
        "tecnica en cuidados auxiliares",
        "tecnico de cuidados auxiliares",
        "cuidados auxiliares de enfermeria",
        "tecnico auxiliar de enfermeria",
        "gerocultor",
        "gerocultora",
        "auxiliar de geriatria",
        "auxiliar sociosanitario",
        "atencion sociosanitaria",
        "cuidador",
        "cuidadora",
        "auxiliar de clinica",
        "auxiliar de ayuda a domicilio",
      ],
      "TCAE",
    ],
    [["celador", "celadora", "camillero", "camillera"], "Celador"],
    [["enfermer", "matron", "nurse", "nursing"], "Enfermería"],
    // Técnicos con título explícito (antes de Medicina: "técnico en radiodiagnóstico").
    [
      [
        "tecnico superior",
        "tecnica superior",
        "tecnico especialista",
        "tecnico de laboratorio",
        "tecnico en laboratorio",
        "tecnico de rayos",
        "tecnico en radio",
        "tecnico en imagen",
        "tecnico de imagen",
        "tecnico en emergencias",
        "tecnico de emergencias",
        "tecnico sanitario",
        "tecnico en anatomia",
        "terapeuta ocupacional",
        "logoped",
        "audioprotes",
        "ortoprotes",
        "podolog",
        "optometr",
        "ortoptist",
      ],
      "Técnico sanitario",
    ],
    [
      [
        "medico",
        "medica ",
        "facultativo",
        "medicina",
        "cirujano",
        "pediatra",
        "anestesi",
        "dermatolog",
        "traumatolog",
        "urolog",
        "oftalmolog",
        "psiquiatr",
        "radiologo",
        "geriatra",
        "internista",
        "ginecolog",
        "obstetr",
        "neurolog",
        "cardiolog",
        "patologo",
        "forense",
        "physician",
        "medico residente",
        "reumatolog",
        "endocrin",
        "dermatolog",
        "traumatolog",
        "otorrino",
        "urolog",
        "oftalmolog",
        "neumolog",
        "nefrolog",
        "hematolog",
        "oncolog",
        "anestesiolog",
        "psiquiatra",
      ],
      "Medicina",
    ],
    [["fisioterap", "physiotherap", "osteopat"], "Fisioterapia"],
    [
      [
        "radiologia",
        "radiodiagnostico",
        "laboratorio",
        "laboratory",
        "diagnostico por imagen",
        "analisis clinicos",
        "anatomia patologica",
        "biolog",
        "bioquim",
        "microbiolog",
        "biomedic",
        "dietetica",
      ],
      "Técnico sanitario",
    ],
    [["psicolog", "psychologist"], "Psicología"],
    [["nutric", "dietista"], "Nutrición"],
    [
      [
        "trabajador social",
        "trabajadora social",
        "trabajo social",
        "integrador social",
        "educador social",
      ],
      "Trabajo social",
    ],
    [
      [
        "coordinador",
        "coordinadora",
        "director",
        "directora",
        "subdirector",
        "gerente",
        "gestor",
        "gestora",
        "jefe de",
        "jefa de",
        "supervisor",
        "supervisora",
        "responsable de",
        "recursos humanos",
        "calidad",
        "compliance",
        "logistica",
        "almacen",
        "compras",
        "mantenimiento",
        "financier",
        "contab",
        "controller",
        "limpieza",
        "cocinero",
        "cocina",
        "seguridad",
      ],
      "Gestión y apoyo",
    ],
    [
      [
        "administrativ",
        "recepcion",
        "secretari",
        "atencion al cliente",
        "atencion al paciente",
        "contact center",
        "call center",
        "telefonista",
        "admision",
        "documentacion clinica",
      ],
      "Administrativo",
    ],
  ];
  for (const [needles, label] of rules) {
    if (needles.some((needle) => t.includes(normalize(needle)))) return label;
  }
  // IT / investigación explícitos
  if (
    [
      "conductor",
      "chofer",
      "helpdesk",
      "informatica",
      "sistemas",
      "data analytics",
      "ingenier",
      "postdoc",
      "investigador",
      "researcher",
      "desarrollador",
    ].some((needle) => t.includes(needle))
  ) {
    return "Otros";
  }
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
  // Barras/espacos partem a rota /empleo/[slug].
  return !slug || /[\/\\?#%\s]/.test(slug);
}

function publishedLabel(value: string | null) {
  if (!value) return "Reciente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Reciente";
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es-ES");
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
      // Listas compactas; sem linha vazia entre título/intro e a lista.
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
/** Vaga publicada há mais de 1 ano sem data de fim futura: tratada como encerrada. */
const MAX_JOB_AGE_DAYS = 365;
/** Fonte sem devolver a vaga há 7 dias (~28 execuções falhadas): tratada como encerrada. */
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
 * Data de publicação real: a da fonte se for válida e não futura; senão a
 * primeira vez que vimos a vaga (createdAt). Nunca a hora do pedido.
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

/** Vaga publicada que já não deve ser servida como ativa (listagens, sitemap, JobPosting). */
function isInactive(job: StoredJob) {
  if (isClosedNoticeTitle(job.title)) return true;
  const now = Date.now();
  const lastSeen = Date.parse(job.lastSeenAt || job.updatedAt || "");
  // Prazo da fonte passado, mas a fonte ainda publica a vaga (visto há <2 dias):
  // continua ativa — o validThrough passa a ser última vez vista + 30 dias.
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
 * Net-Empregos envia alguns títulos com entidades HTML duplamente codificadas
 * ("Operat&#243;rio", "&#128226; NOVO"). Descodifica até 2 níveis.
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

/** Títulos sem emojis/pictogramas (📢, 🤝, 📍). */
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
  // Com requirements reais, "Responsabilidades" usa só o 1.º bloco da
  // descrição (perfil), para não misturar com "Condições oferecidas".
  const profileBlock = description.split(/\n\n+/)[0] || description;
  const responsibilitySource =
    requirements.length > 0 ? splitList(profileBlock) : descriptionLines;
  return {
    slug: job.slug,
    // Também na leitura: vagas ingeridas antes da correção ainda têm "&#243;".
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
          : ["Consulta los detalles e inscríbete en la web de la entidad."],
    responsibilities:
      responsibilitySource.slice(0, 5).length > 0
        ? responsibilitySource.slice(0, 5)
        : ["Consulta la descripción completa en la página de la entidad."],
    applicationUrl: job.applicationUrl,
    salary: job.salary,
  };
}

// Cache em memória do ficheiro (2.5 MB+) para não reler/parsear em cada pedido.
// Invalida automaticamente quando o mtime do jobs.json muda (scrape/admin).
let jobsCache: { mtimeMs: number; file: JobsFile } | null = null;

// Cards + índice por slug derivados do ficheiro. Evita toJobCard×N e scans lineares
// em cada SSR (detalhe/home/listagem). Soft-TTL refresca publishedLabel ("Hoje").
const CARDS_TTL_MS = 60_000;
type DerivedJobsCache = {
  mtimeMs: number;
  builtAt: number;
  cards: JobCardData[];
  bySlug: Map<string, StoredJob>;
  /** Republicações: slug da cópia → slug da vaga principal. */
  canonicalOf: Map<string, string>;
  /** Variantes do nome do empregador → nome a mostrar. */
  companyNames: Map<string, string>;
};
let derivedJobsCache: DerivedJobsCache | null = null;

function clearDerivedJobsCache() {
  derivedJobsCache = null;
}

/**
 * Fila para ler-alterar-gravar o jobs.json: dois ingests em simultâneo liam a
 * mesma versão e o segundo a gravar apagava as alterações do primeiro.
 */
let jobsFileQueue: Promise<unknown> = Promise.resolve();

function withJobsFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = jobsFileQueue.then(task, task);
  jobsFileQueue = run.catch(() => undefined);
  return run;
}

/** Nº de vagas da última versão lida/gravada (para a guarda do writeJobsFile). */
let knownJobsCount = 0;

async function readJobsFile(): Promise<JobsFile> {
  const filePath = jobsFilePath();
  try {
    const info = await stat(filePath);
    if (jobsCache && jobsCache.mtimeMs === info.mtimeMs) {
      return jobsCache.file;
    }
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as JobsFile;
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
    jobsCache = { mtimeMs: info.mtimeMs, file };
    clearDerivedJobsCache();
    return file;
  } catch (error) {
    // Ainda não há ficheiro (1.ª execução): base vazia.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { updatedAt: new Date(0).toISOString(), jobs: [] };
    }
    // Ilegível (ex.: lido a meio de uma escrita): nunca devolver vazio — o ingest
    // seguinte gravava por cima e apagava o histórico (BR, 2026-10-27).
    if (jobsCache) return jobsCache.file;
    throw new Error(`jobs.json ilegível: ${(error as Error).message}`);
  }
}

async function getDerivedJobsCache(): Promise<DerivedJobsCache> {
  const file = await readJobsFile();
  const mtimeMs = jobsCache?.mtimeMs ?? 0;
  const now = Date.now();
  if (
    derivedJobsCache &&
    derivedJobsCache.mtimeMs === mtimeMs &&
    now - derivedJobsCache.builtAt < CARDS_TTL_MS
  ) {
    return derivedJobsCache;
  }

  const bySlug = new Map<string, StoredJob>();
  for (const job of file.jobs) {
    bySlug.set(job.slug, job);
    const normalized = slugify(job.slug);
    if (normalized && normalized !== job.slug && !bySlug.has(normalized)) {
      bySlug.set(normalized, job);
    }
  }

  const active = file.jobs.filter(
    (job) =>
      job.status === "published" &&
      !isInactive(job) &&
      !isClosedNoticeTitle(job.title),
  );
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
      return a.title.localeCompare(b.title, "es");
    });

  derivedJobsCache = {
    mtimeMs,
    builtAt: now,
    cards,
    bySlug,
    canonicalOf,
    companyNames,
  };
  return derivedJobsCache;
}

/** Sufixos legais e palavras genéricas ignorados ao juntar variantes do nome do empregador. */
const COMPANY_NAME_NOISE =
  /\b(s a|sa|s s|lda|ltda|unipessoal|eireli|epp|epe|e p e|ip|i p|portugal|brasil|grupo|group)\b/g;

function companyNameKey(name: string) {
  return normalize(name).replace(COMPANY_NAME_NOISE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Variantes do mesmo empregador ("IVC EVIDENSIA PORTUGAL S A" / "IVC Evidensia",
 * "ULS …, EPE" / "ULS …, E.P.E.") → um só nome de apresentação: o mais usado,
 * preferindo o que não está todo em maiúsculas. Devolve nome original → nome a mostrar.
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
 * Republicações da mesma vaga (mesmo título, entidade, local e descrição, IDs
 * diferentes na fonte — ex.: Seconci ×33, DaVita ×22). Fica a mais antiga;
 * as outras saem das listagens/sitemap e apontam canonical para ela.
 * Devolve slug da cópia → slug da principal.
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

/** Cópias diárias do jobs.json (as mais recentes) — rede de segurança contra perdas. */
const DAILY_BACKUPS_KEPT = 7;

async function backupJobsFileDaily(filePath: string) {
  const backup = `${filePath}.bak-daily-${new Date().toISOString().slice(0, 10)}`;
  if (await stat(backup).then(() => true, () => false)) return;
  try {
    await copyFile(filePath, backup);
  } catch {
    return; // ainda não existe jobs.json (1.ª escrita)
  }
  const dir = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.bak-daily-`;
  const old = (await readdir(dir))
    .filter((name) => name.startsWith(prefix))
    .sort()
    .slice(0, -DAILY_BACKUPS_KEPT);
  await Promise.all(
    old.map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

async function writeJobsFile(file: JobsFile) {
  const filePath = jobsFilePath();
  // Uma escrita que deixa menos de metade das vagas é quase de certeza um bug
  // (ex.: base lida como vazia): recusar em vez de apagar o histórico.
  if (knownJobsCount >= 100 && file.jobs.length < knownJobsCount / 2) {
    throw new Error(
      `Escritura de jobs.json rechazada: pasaría de ${knownJobsCount} a ${file.jobs.length} ofertas.`,
    );
  }
  await mkdir(dataDir(), { recursive: true });
  await backupJobsFileDaily(filePath);
  // Escrita atómica (temporário + rename): nenhuma leitura apanha o ficheiro a meio.
  // Mantém dono e permissões do ficheiro anterior (a app corre como root).
  const before = await stat(filePath).catch(() => null);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(file, null, 2), { mode: 0o600 });
  if (before) {
    await chmod(tmpPath, before.mode & 0o777);
    await chown(tmpPath, before.uid, before.gid).catch(() => undefined);
  }
  await rename(tmpPath, filePath);
  knownJobsCount = file.jobs.length;
  // Manter o cache coerente após escrita (ingest/reclassify/repair).
  try {
    const info = await stat(jobsFilePath());
    jobsCache = { mtimeMs: info.mtimeMs, file };
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
    t.includes("lista de classificacao") ||
    t.includes("lista de ordenacao") ||
    t.includes("homologacao da lista") ||
    t.includes("classificacao final") ||
    t.includes("anulacao do ato") ||
    t.includes("anulacao da referencia") ||
    t.startsWith("anulacao ") ||
    // Avisos de procedimentos (INEM/DRE), não vagas.
    t.startsWith("nota informativa") ||
    t.startsWith("convocatoria") ||
    t.includes("lista de candidatos") ||
    t.includes("lista unitaria") ||
    t.includes("lista da avaliacao") ||
    t.includes("retificacao da lista") ||
    // Título partido pelo encurtador (ex.: "(306 (306 vagas)").
    /^\(\d/.test(title.trim()) ||
    // Fora do âmbito: apoio ao cliente noutras línguas.
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
  sector: "publico" | "privado" | "concertado";
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
 * O scraper do VPS só tem o excerto do RSS do Net-Empregos (~250 caracteres);
 * a descrição completa vem da página de detalhe, corrida fora do VPS. Um
 * excerto curto não substitui uma descrição mais completa da mesma vaga.
 */
function keepFullerDescription(existing: StoredJob | undefined, incoming: string) {
  const current = existing?.description || "";
  if (current.length <= incoming.length || incoming.length >= 400) return incoming;
  const head = normalize(incoming.replace(/(?:\.\.\.|…)\s*$/, "")).slice(0, 60);
  const sameText = Boolean(head) && normalize(current).includes(head);
  return sameText || existing?.source === "net_empregos" ? current : incoming;
}

/** Agregadores: perdem para a mesma vaga publicada pelo próprio empregador. */
const AGGREGATOR_SOURCES = new Set<string>([
  // Portales generalistas / agregadores (ids de fuente): si el empleador publica la misma
  // oferta directamente, la suya pasa a principal y la copia queda como duplicado.
  "sne",
]);

export function ingestJobs(...args: Parameters<typeof ingestJobsUnlocked>) {
  return withJobsFileLock(() => ingestJobsUnlocked(...args));
}

export type IngestOptions = {
  /** false: el scraper sabe que el lote está incompleto (no expirar las ausentes). */
  expireMissing?: boolean;
  /** La lista es completa aunque sea pequeña (expira las ausentes con cualquier lote > 0). */
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
  // Vagas vivas publicadas pelo próprio empregador (não agregador), por hash.
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
      : !item.profession?.trim() || item.profession.trim() === "Otros"
        ? guessProfession(title, item.profession?.trim() || "Otros")
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
        // A vaga existia via agregador; a do empregador (descrição completa,
        // candidatura direta) passa a principal e a cópia fica duplicada.
        existingHash.status = "duplicate";
        existingHash.reviewReason = `Duplicado de ${source}:${sourceId}`;
        existingHash.updatedAt = now;
      } else if (existingHash.source !== source && hashIsLive) {
        status = "duplicate";
        reviewReason = `Duplicado de ${existingHash.source}:${existingHash.sourceId}`;
      } else if (
        existingHash.source === source &&
        existingHash.sourceId !== sourceId &&
        hashIsLive
      ) {
        // Mesma fonte, mesmo título/empresa/comunidad, IDs de origem diferentes
        // (ex.: CUF republica a mesma vaga com outro sourceId).
        status = "duplicate";
        reviewReason = `Duplicado interno de ${existingHash.source}:${existingHash.sourceId}`;
      }
    }

    if (
      AGGREGATOR_SOURCES.has(source) &&
      status !== "duplicate" &&
      employerHashes.has(dedupeHash)
    ) {
      // Cópia de agregador de uma vaga que o empregador publica diretamente.
      status = "duplicate";
      reviewReason = "Duplicado de oferta publicada por el empleador";
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
  // No con lotes parciales: el 2026-11-06 el SNE devolvió 5 ofertas (en vez de ~870)
  // y se expiraron todas las demás. Solo expira con un lote de al menos la mitad de lo
  // publicado (o si el scraper declara la lista completa) y nunca con 0 ofertas.
  const existingPublished = file.jobs.filter(
    (job) => job.source === source && job.status === "published",
  ).length;
  const shouldExpireMissing =
    options.expireMissing !== false &&
    incoming.length > 0 &&
    (options.authoritative === true ||
      incoming.length >= Math.floor(existingPublished * 0.5));
  // Con lote parcial, una oferta que no aparece hace más de 3 días expira igualmente
  // (si la fuente encoge de verdad, las antiguas no quedan publicadas para siempre).
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

export function reclassifyOutrosProfessions(...args: Parameters<typeof reclassifyOutrosProfessionsUnlocked>) {
  return withJobsFileLock(() => reclassifyOutrosProfessionsUnlocked(...args));
}

async function reclassifyOutrosProfessionsUnlocked() {
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
    // Sempre a partir do título — sem fallback para a categoria actual.
    const next = guessProfession(job.title, "Otros");
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

/** Encurta títulos burocráticos (concursos públicos) para a função. */
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
    const nextProfession = guessProfession(nextTitle, job.profession || "Otros");
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

/** Marca como duplicate vagas published/pending com o mesmo dedupeHash (mantém a mais antiga). */
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
