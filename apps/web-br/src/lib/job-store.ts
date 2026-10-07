import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeInlineLists } from "@/lib/format-job-text";
import { shortenJobTitle } from "@/lib/shorten-job-title";

export type StoredJob = {
  id: string;
  slug: string;
  title: string;
  company: string;
  locationDistrict: string;
  locationConcelho: string | null;
  profession: string;
  specialty: string | null;
  sector: "publico" | "privado" | "ipss";
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
  createdAt: string;
  updatedAt: string;
};

export type JobCardData = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Público" | "Privado" | "Filantrópico";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
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
  ipss: "Filantrópico",
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
  // Aliases de grupos privados conhecidos (antes de strip genérico).
  if (raw.includes("cuf") || raw.includes("jose de mello")) return "cuf";
  if (raw.includes("luz saude") || raw.includes("hospital da luz")) {
    return "luz saude";
  }
  if (raw.includes("lusiadas")) return "lusiadas";
  if (
    raw.includes("trofa saude") ||
    raw.includes("hospital da trofa") ||
    raw.includes("grupo vnc")
  ) {
    return "trofa saude";
  }
  if (raw.includes("joaquim chaves") || raw === "jcs") return "joaquim chaves";
  if (raw.includes("champalimaud")) return "champalimaud";
  if (raw.includes("germano de sousa") || raw.includes("germano sousa")) {
    return "germano de sousa";
  }
  if (raw.includes("hpa") || raw.includes("hospital particular do algarve")) {
    return "hpa";
  }
  if (raw.includes("holon")) return "holon";
  if (raw.includes("pharmabsc") || raw.includes("pharma bsc")) return "pharmabsc";
  return raw
    .replace(/\b(hospital|clinica|grupo|saúde|saude)\b/g, " ")
    .replace(/\b(e p e|epe|sa|s a)\b/g, " ")
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

export function guessProfession(title: string, fallback = "Outros") {
  const t = normalize(title);
  // Só títulos que começam por "Formação …" (não texto de descrição).
  if (
    t.length < 70 &&
    t.startsWith("formacao ") &&
    !t.includes("interno") &&
    !t.includes("formacao especifica")
  ) {
    return "Formação";
  }
  const rules: Array<[string[], string]> = [
    // Formação antes de Enfermagem (ex.: "Formador de Enfermagem").
    [
      [
        "formador",
        "formadora",
        "formadores",
        "formadoras",
        "tecnico de formacao",
        "tecnica de formacao",
        "responsavel de formacao",
        "coordenador de formacao",
        "coordenadora de formacao",
        "instructor",
        "instrutor",
        "instrutora",
        "e-learning",
        "elearning",
        "educacao clinica",
        "treino clinico",
      ],
      "Formação",
    ],
    // Comercial/farma antes de Medicina/Farmácia (visitador médico, etc.).
    [
      [
        "delegado de informacao",
        "delegada de informacao",
        "visitador medico",
        "visitadora medica",
        "medical science liaison",
        "msl",
        "key account",
        "comercial farmaceut",
        "comercial farma",
        "sales medical",
        "medical sales",
        "business development",
        "account manager",
        "delegado comercial",
        "delegada comercial",
        "comercial de dispositivos",
        "product specialist",
        "especialista de produto",
      ],
      "Comercial / Farma",
    ],
    [
      [
        "farmaceut",
        "farmacia",
        "pharmacist",
        "tecnico de farmacia",
        "tecnica de farmacia",
        "auxiliar de farmacia",
        "diretor tec",
        "director tec",
        "diretor tecnico",
        "taf",
      ],
      "Farmácia",
    ],
    [
      [
        "auxiliar de acao medica",
        "auxiliar de accao medica",
        "auxiliar de acao",
        "auxiliar de accao",
        "assistente operacional",
        "assistentes operacionais",
        "geriatr",
        "cuidador",
        "cuidados continuados",
        "auxiliar de saude",
        "auxiliar de enferm",
        "auxiliar",
      ],
      "Auxiliares",
    ],
    [["enfermeir", "enfermagem", "nurse", "nursing"], "Enfermagem"],
    // Antes de Medicina — "assistente de medicina dentária" não é médico.
    [["assistente dent", "assistente de medicina dent"], "Administrativo"],
    [
      [
        "medico",
        "medica ",
        "medicas",
        "medicina geral",
        "medicina dentar",
        "medicina interna",
        "dentista",
        "cirurgi",
        "internato",
        "physician",
        "mgf",
        "clinica geral",
        "assistente graduado",
        "assistente hospitalar",
        "neurolog",
        "ginecolog",
        "obstetr",
        "pathologist",
        "patologista",
      ],
      "Medicina",
    ],
    [["fisioterapeut", "fisioterap", "physiotherapist", "physiotherapy"], "Fisioterapia"],
    [
      [
        "radiologia",
        "cardiopneumolog",
        "analises",
        "laboratorio",
        "laboratory",
        "diagnostico",
        "terapeut",
        "audiolog",
        "imagiolog",
        "ortoptic",
        "ortotic",
        "neurofisiolog",
        "anatomia patol",
        "histopatholog",
        "pathology",
        "oftalmolog",
        "higienista",
        "optometrist",
        "podolog",
        "research technician",
        "tecnico de investig",
        "biolog",
        "analises clinicas",
        "ciencias biomedicas",
      ],
      "Técnico de Saúde",
    ],
    [["psicolog", "psychologist", "neuropsychiatr"], "Psicologia"],
    [["nutric", "dietista"], "Nutrição"],
    [["assistente social", "equipa comunitaria"], "Assistência Social"],
    [
      [
        "coordenador",
        "coordenadora",
        "gestor de servico",
        "gestora de servico",
        "gestor hospital",
        "gestor de unidade",
        "gestora de unidade",
        "administrador hospitalar",
        "administrador",
        "director clinico",
        "diretor clinico",
        "diretora clinica",
        "recursos humanos",
        "qualidade",
        "compliance",
        "logistica",
        "armazem",
        "compras",
        "aprovisionamento",
        "manutencao",
        "financeiro",
        "contabil",
        "contas a receber",
        "administracao hospital",
        "gestao de utentes",
        "case manager",
        "gestor de caso",
        "seguranca no trabalho",
        "protecao de dados",
        "cozinheir",
        "restauracao",
        "lab manager",
        "lab administrator",
      ],
      "Gestão & suporte",
    ],
    [
      [
        "administrativ",
        "recepcion",
        "rececion",
        "secretaria",
        "gestor de cliente",
        "gestao do cliente",
        "servico ao cliente",
        "contact center",
        "assistente tecnico",
      ],
      "Administrativo",
    ],
  ];
  for (const [needles, label] of rules) {
    if (needles.some((needle) => t.includes(normalize(needle)))) return label;
  }
  // IT / investigação explícitos
  if (
    [
      "motorista",
      "helpdesk",
      "informatica",
      "sistemas",
      "data analytics",
      "engenheir",
      "postdoc",
      "postdoctoral",
      "phd student",
      "investigador",
      "researcher",
      "gestor aplicacional",
    ].some((needle) => t.includes(needle))
  ) {
    return "Outros";
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
  // Barras/espacos partem a rota /vagas/[slug].
  return !slug || /[\/\\?#%\s]/.test(slug);
}

function publishedLabel(value: string | null) {
  if (!value) return "Recente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recente";
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR");
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

const SECTION_HEADING_RE =
  /^(condi[cç][oõ]es\s+oferecidas|requisitos|perfil|responsabilidades|o\s+que\s+oferecemos|benef[ií]cios|fun[cç][aã]o|descri[cç][aã]o)\s*:?\s*$/i;

/** Extrai bullets sob um heading (ex.: "Responsabilidades:") da descrição. */
function extractSectionBullets(
  description: string,
  heading: RegExp,
): string[] {
  const lines = cleanDescription(description).split("\n");
  let capturing = false;
  const items: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const asHeading = line.replace(/:$/, "").trim();
    if (SECTION_HEADING_RE.test(asHeading) || SECTION_HEADING_RE.test(line)) {
      capturing = heading.test(asHeading);
      continue;
    }
    if (!capturing) continue;
    const bullet = line.replace(/^[-•*\d.)\s]+/, "").trim();
    if (bullet.length > 8) items.push(bullet);
  }
  return items.slice(0, 8);
}

/** Listagem/home: evita parse de descrições longas (PCI/Gupy) em milhares de vagas. */
function toJobCardListItem(job: StoredJob): JobCardData {
  return {
    slug: job.slug,
    title: job.title,
    company: job.company,
    district: job.locationDistrict,
    city: job.locationConcelho || job.locationDistrict,
    sector: SECTOR_LABEL[job.sector],
    contract: job.contractType || "A definir",
    profession: job.profession,
    publishedLabel: publishedLabel(job.publishedAt),
    publishedAt: job.publishedAt || job.createdAt.slice(0, 10),
    expiresAt: job.expiresAt,
    description: "",
    requirements: [],
    responsibilities: [],
    applicationUrl: job.applicationUrl,
    salary: job.salary,
  };
}

export function toJobCard(job: StoredJob): JobCardData {
  const description = cleanDescription(job.description);
  const requirements = splitList(job.requirements);
  const descriptionLines = splitList(description);
  const thinDescription =
    description.length < 80 && !/\n/.test(description.trim());
  // Preferir bullets da secção "Responsabilidades" (scrapers Gupy/IEFP).
  const sectionResponsibilities = extractSectionBullets(
    description,
    /^responsabilidades$/i,
  );
  // Com requirements reais e sem secção, "Responsabilidades" usa só o 1.º
  // bloco da descrição (perfil), para não misturar com "Condições oferecidas".
  const profileBlock = description.split(/\n\n+/)[0] || description;
  const responsibilitySource =
    sectionResponsibilities.length > 0
      ? sectionResponsibilities
      : requirements.length > 0
        ? splitList(profileBlock)
        : descriptionLines;
  return {
    slug: job.slug,
    title: job.title,
    company: job.company,
    district: job.locationDistrict,
    city: job.locationConcelho || job.locationDistrict,
    sector: SECTOR_LABEL[job.sector],
    contract: job.contractType || "A definir",
    profession: job.profession,
    publishedLabel: publishedLabel(job.publishedAt),
    publishedAt: job.publishedAt || job.createdAt.slice(0, 10),
    expiresAt: job.expiresAt,
    description,
    requirements:
      requirements.length > 0
        ? requirements
        : !thinDescription && descriptionLines.slice(0, 4).length > 0
          ? descriptionLines.slice(0, 4)
          : ["Consulte os detalhes e candidate-se no site da entidade."],
    responsibilities:
      responsibilitySource.slice(0, 5).length > 0
        ? responsibilitySource.slice(0, 5)
        : ["Consultar descrição completa na página da entidade."],
    applicationUrl: job.applicationUrl,
    salary: job.salary,
  };
}

// Cache em memória do ficheiro (10 MB+) para não reler/parsear em cada pedido.
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
};
let derivedJobsCache: DerivedJobsCache | null = null;

function clearDerivedJobsCache() {
  derivedJobsCache = null;
}

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
  } catch {
    return { updatedAt: new Date(0).toISOString(), jobs: [] };
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

  const cards = file.jobs
    .filter(
      (job) =>
        job.status === "published" &&
        !isPastExpiry(job) &&
        !isClosedNoticeTitle(job.title),
    )
    .map(toJobCardListItem)
    .sort((a, b) => {
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "pt");
    });

  derivedJobsCache = { mtimeMs, builtAt: now, cards, bySlug };
  return derivedJobsCache;
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
  await mkdir(dataDir(), { recursive: true });
  await writeFile(jobsFilePath(), JSON.stringify(file, null, 2), { mode: 0o600 });
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
    if (isPastExpiry(match)) {
      return { job: match, expired: true as const };
    }
    return { job: match, expired: false as const };
  }
  if (match.status === "expired" || isPastExpiry(match)) {
    return { job: match, expired: true as const };
  }
  return null;
}

function isPastExpiry(job: StoredJob) {
  if (!job.expiresAt) return false;
  const expires = Date.parse(job.expiresAt);
  return !Number.isNaN(expires) && expires < Date.now();
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
    t.startsWith("anulacao ")
  );
}

const CONCURSO_JUDICIAL_TOKEN_RE =
  /(?:^|\s)(?:trt|tre|trf|stj|stf|stm|tse|mpu|tcu|tce)(?:\s|$|-)/;
const CONCURSO_NON_HEALTH_TOKEN_RE =
  /(?:^|\s)(?:trt|tre|trf|stj|stf|stm|tse|mpu|tcu|tce)(?:\s|$|-)/;
const CONCURSO_JUDICIAL_PHRASES = [
  "tribunal",
  "judiciario",
  "analista judiciario",
  "tecnico judiciario",
  "oficial de justica",
  "ministerio publico",
  "defensoria",
  "cartorio",
];
const CONCURSO_NON_HEALTH_PHRASES = [
  "tribunal",
  "judiciario",
  "analista judiciario",
  "tecnico judiciario",
  "oficial de justica",
  "cartorio",
  "ministerio publico",
  "defensoria",
  "policia federal",
  "policia civil",
  "policia militar",
  "policia rodoviaria",
  "guarda municipal",
  "corpo de bombeiros",
  "bombeiro militar",
  "bombeiros militar",
  "exercito",
  "marinha do brasil",
  "aeronautica",
  "comando da aeronautica",
  "correios",
  "banco do brasil",
  "receita federal",
  "detran",
  "ibge",
  "transpetro",
  "relacoes exteriores",
  "educacao fisica",
  "concurso publico nacional unificado",
  "concurso nacional unificado",
  "agente penitenciario",
  "escrivao",
  "delegado",
];

const STRONG_CARGO_RES = [
  /\bpara\s+(?:o\s+)?(?:cargo\s+de\s+)?(?:tecnic[oa]s?\s+de\s+enfermagem|auxiliares?\s+de\s+enfermagem|enfermeir[oa]s?|m[eé]dic[oa]s?|medicina(?!\s+veterinar)|dentistas?|odont[oó]log[oa]s?|odontologia|fisioterapeutas?|fisioterapia|psic[oó]log[oa]s?|psicologia|nutricionistas?|nutri[cç][aã]o|farmac[eê]utic[oa]s?|farm[aá]cia|fonoaudi[oó]log[oa]s?|biom[eé]dic[oa]s?|terapeutas?\s+ocupacionais?|assistentes?\s+sociais?)\b/i,
  /\bcargos?\s+(?:de\s+)?(?:tecnic[oa]s?\s+de\s+enfermagem|auxiliares?\s+de\s+enfermagem|enfermeir[oa]s?|m[eé]dic[oa]s?|medicina(?!\s+veterinar)|dentistas?|odont[oó]log[oa]s?|odontologia|fisioterapeutas?|fisioterapia|psic[oó]log[oa]s?|psicologia|nutricionistas?|nutri[cç][aã]o|farmac[eê]utic[oa]s?|farm[aá]cia|fonoaudi[oó]log[oa]s?|biom[eé]dic[oa]s?|terapeutas?\s+ocupacionais?|assistentes?\s+sociais?)\b/i,
  /\bvagas?\s+(?:para|de)\s+(?:tecnic[oa]s?\s+de\s+enfermagem|auxiliares?\s+de\s+enfermagem|enfermeir[oa]s?|m[eé]dic[oa]s?|medicina(?!\s+veterinar)|dentistas?|odont[oó]log[oa]s?|odontologia|fisioterapeutas?|fisioterapia|psic[oó]log[oa]s?|psicologia|nutricionistas?|nutri[cç][aã]o|farmac[eê]utic[oa]s?|farm[aá]cia|fonoaudi[oó]log[oa]s?|biom[eé]dic[oa]s?|terapeutas?\s+ocupacionais?|assistentes?\s+sociais?)\b/i,
  /\b(?:enfermeir[oa]s?|m[eé]dic[oa]s?|dentistas?|psic[oó]log[oa]s?)[^.\n]{0,48}\(\s*\d+\s*vagas?/i,
  /\boficiais?\s+(?:m[eé]dic|odont)/i,
  /\b(?:1[oº°]?|primeiro)\s*ten\b[^.\n]{0,40}\b(?:m[eé]dic|dentista|psic)/i,
  /\b(?:areas?|na area)\s+d[ae]\s+sa[uú]de\b/i,
  /\bservi[cç]o\s+de\s+sa[uú]de\b/i,
  /\boportunidades?\s+para\s+(?:enfermeir[oa]s?|m[eé]dic[oa]s?|dentistas?|psic[oó]log[oa]s?)\b/i,
];

function isJudicialConcursoSignal(
  title: string,
  company?: string | null,
  slug?: string | null,
) {
  const blob = normalize(`${title} ${company || ""} ${slug || ""}`);
  if (!blob) return false;
  if (CONCURSO_JUDICIAL_TOKEN_RE.test(` ${blob} `)) return true;
  return CONCURSO_JUDICIAL_PHRASES.some((p) => blob.includes(p));
}

function hasStrongConcursoHealthCargo(text: string) {
  return STRONG_CARGO_RES.some((rx) => rx.test(text));
}

function judicialAllowsHealthCargo(text: string) {
  const n = normalize(text);
  if (
    /analista judiciario|tecnico judiciario|oficial de justica|analistas e tecnicos|analista e tecnico/.test(
      n,
    )
  ) {
    return false;
  }
  if (
    /especialidade\s+(?:enfermagem|medicina|medico(?:\s+do\s+trabalho)?|odontologia|psicologia|servico social|farmacia|fisioterapia|nutricao)/.test(
      n,
    )
  ) {
    return false;
  }
  return hasStrongConcursoHealthCargo(text);
}

function headerNonHealthSignal(title: string, company?: string | null) {
  const blob = normalize(`${title} ${company || ""}`);
  if (!blob) return false;
  if (CONCURSO_NON_HEALTH_TOKEN_RE.test(` ${blob} `)) return true;
  return CONCURSO_NON_HEALTH_PHRASES.some((p) => blob.includes(p));
}

/** Espelha scrapers-br/common/normalize.looks_like_health_concurso. */
export function looksLikeHealthConcurso(
  title: string,
  company?: string | null,
  summary?: string | null,
  slug?: string | null,
) {
  const raw = `${title} ${company || ""} ${summary || ""}`;
  const blob = normalize(raw);
  if (!blob) return false;

  // Tribunais/MP antes de keywords clínicas (evita retítulo falso Enfermeiro).
  if (isJudicialConcursoSignal(title, company, slug)) {
    return judicialAllowsHealthCargo(raw);
  }
  if (headerNonHealthSignal(title, company)) {
    return hasStrongConcursoHealthCargo(raw);
  }

  const healthEmployers = [
    "secretaria de saude",
    "ministerio da saude",
    "fiocruz",
    "imip",
    "hospital",
    "santa casa",
    "hemocentro",
    "samu",
    "fundacao de saude",
    "fundacao saude",
    "instituto de medicina",
    "escola de saude",
    "servico de saude",
    "sesa",
  ];
  if (healthEmployers.some((h) => blob.includes(h))) return true;

  const clinical = [
    "enfermeir",
    "enfermagem",
    "medico",
    "medica ",
    "odontolog",
    "dentista",
    "fisioterap",
    "nutricion",
    "psicolog",
    "farmaceut",
    "farmacia",
    "fonoaudi",
    "biomedic",
    "radiolog",
    "terapeuta ocupacional",
    "terapia ocupacional",
    "assistente social",
    "auxiliar de enfermagem",
    "tecnico de enfermagem",
    "tecnica de enfermagem",
    "agente comunitario",
    "agente de saude",
    "samu",
    "ubs",
    "hospital",
    "vigilancia sanitaria",
    "sanitarista",
    "saude da familia",
    "secretaria de saude",
    "secretaria municipal de saude",
    "secretaria estadual de saude",
    "ministerio da saude",
    "area da saude",
    "area de saude",
    "profissional de saude",
    "tecnico de saude",
    "tecnica de saude",
    "tecnico em saude",
    "tecnica em saude",
    "residencia medica",
    "residencia multiprofissional",
    "multiprofissional",
    "oficial medico",
    "oficial odont",
    "servico de saude",
    "hemocentro",
    "hemoterapia",
    "banco de sangue",
    "pronto socorro",
    "pronto atendimento",
    "areas de saude",
    "areas da saude",
    "na area da saude",
    "na area de saude",
  ];
  if (clinical.some((c) => blob.includes(c))) return true;

  if (CONCURSO_NON_HEALTH_TOKEN_RE.test(` ${blob} `)) return false;
  if (CONCURSO_NON_HEALTH_PHRASES.some((p) => blob.includes(p))) return false;
  // Sem cargo/órgão clínico explícito: rejeita (ex.: "vários cargos" genérico).
  return false;
}

export async function getJobCard(slug: string) {
  const found = await getStoredJobBySlugIncludingExpired(slug);
  if (!found) return null;
  return {
    job: toJobCard(found.job),
    expired: found.expired,
  };
}

export type IngestJobInput = {
  title: string;
  company: string;
  location_district: string;
  location_concelho?: string | null;
  profession: string;
  specialty?: string | null;
  sector: "publico" | "privado" | "ipss";
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

export async function ingestJobs(source: string, incoming: IngestJobInput[]) {
  const file = await readJobsFile();
  const now = new Date().toISOString();
  const bySourceId = new Map(
    file.jobs
      .filter((job) => job.source === source)
      .map((job) => [`${job.source}:${job.sourceId}`, job] as const),
  );
  const byHash = new Map(file.jobs.map((job) => [job.dedupeHash, job] as const));

  let created = 0;
  let updated = 0;
  let ignored = 0;
  let review = 0;

  for (const item of incoming) {
    const title = shortenJobTitle(item.title?.trim() || "");
    const company = item.company?.trim();
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
    const description = cleanDescription(item.description?.trim() || title);
    const profession =
      !item.profession?.trim() || item.profession.trim() === "Outros"
        ? guessProfession(title, item.profession?.trim() || "Outros")
        : item.profession.trim();
    const incomplete = !description || description.length < 40 || !profession;

    let status: StoredJob["status"] =
      item.status || (incomplete ? "pending_review" : "published");
    let reviewReason = item.review_reason || null;

    if (!existingSameSource && existingHash) {
      const hashIsLive =
        existingHash.status === "published" ||
        existingHash.status === "pending_review";
      if (existingHash.source !== source && hashIsLive) {
        status = "duplicate";
        reviewReason = `Duplicado de ${existingHash.source}:${existingHash.sourceId}`;
      } else if (
        existingHash.source === source &&
        existingHash.sourceId !== sourceId &&
        hashIsLive
      ) {
        // Mesma fonte, mesmo título/empresa/distrito, IDs de origem diferentes
        // (ex.: CUF republica a mesma vaga com outro sourceId).
        status = "duplicate";
        reviewReason = `Duplicado interno de ${existingHash.source}:${existingHash.sourceId}`;
      }
    }

    if (status === "pending_review") review += 1;

    const slugBase = buildJobSlug(title, company, sourceId);
    const existingSlug = existingSameSource?.slug;
    const slug =
      existingSlug && !slugNeedsRepair(existingSlug) ? existingSlug : slugBase;

    // PCI: não republicar off-topic soft-expired nem aceitar retítulos judiciais.
    if (source === "pci_concursos") {
      const evidence = description.slice(0, 2500);
      const healthOk = looksLikeHealthConcurso(
        title,
        company,
        evidence,
        existingSlug || slugBase,
      );
      if (!healthOk) {
        status = "expired";
        reviewReason =
          reviewReason || "Fora da saúde (tribunal/concurso off-topic)";
      } else if (
        existingSameSource?.status === "expired" &&
        /fora da sa[uú]de|tribunal|off-topic|judici/i.test(
          existingSameSource.reviewReason || "",
        )
      ) {
        // Enrich/re-scrape não ressuscita off-topic já expirado.
        status = "expired";
        reviewReason = existingSameSource.reviewReason;
      }
    }

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
      requirements: item.requirements?.trim() || null,
      salary: item.salary?.trim() || null,
      applicationUrl,
      source,
      sourceId,
      dedupeHash,
      status,
      reviewReason,
      publishedAt: item.published_at || existingSameSource?.publishedAt || now,
      expiresAt: item.expires_at || null,
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
  // Skip when the payload looks like a partial repair (ex.: 1 job) so we do not
  // wipe the board — only full-ish scrapes may expire missing IDs.
  const existingPublished = file.jobs.filter(
    (job) => job.source === source && job.status === "published",
  ).length;
  const shouldExpireMissing =
    incoming.length >= Math.max(5, Math.floor(existingPublished * 0.5));
  if (shouldExpireMissing) {
    const seen = new Set(incoming.map((item) => String(item.source_id)));
    for (const job of file.jobs) {
      if (
        job.source === source &&
        job.status === "published" &&
        !seen.has(job.sourceId)
      ) {
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

export async function reclassifyOutrosProfessions() {
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
    // Sempre a partir do título — sem fallback para a categoria atual.
    const next = guessProfession(job.title, "Outros");
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

/** Soft-expire editais PCI fora da saúde (tribunais, Forças Armadas, etc.). */
export async function expireNonHealthConcursos() {
  const file = await readJobsFile();
  let changed = 0;
  const now = new Date().toISOString();
  for (const job of file.jobs) {
    if (job.source !== "pci_concursos") continue;
    if (job.status !== "published" && job.status !== "pending_review") continue;
    const summary = `${job.description || ""}`.slice(0, 2500);
    if (looksLikeHealthConcurso(job.title, job.company, summary, job.slug)) {
      continue;
    }
    job.status = "expired";
    job.reviewReason =
      job.reviewReason || "Fora da saúde (tribunal/concurso off-topic)";
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
export async function shortenPublishedJobTitles() {
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
    const nextProfession = guessProfession(nextTitle, job.profession || "Outros");
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
export async function collapseDuplicateHashes() {
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
