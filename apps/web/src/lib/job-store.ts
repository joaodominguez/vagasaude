import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

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
  sector: "Público" | "Privado" | "IPSS";
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
  ipss: "IPSS",
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
  return date.toLocaleDateString("pt-PT");
}

function isListItem(line: string) {
  return /^[-•*]\s+\S/.test(line) || /^\d+[.)]\s+\S/.test(line);
}

function cleanDescription(text: string) {
  const lines = text
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

export function toJobCard(job: StoredJob): JobCardData {
  const description = cleanDescription(job.description);
  const requirements = splitList(job.requirements);
  const descriptionLines = splitList(description);
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
        : descriptionLines.slice(0, 4).length > 0
          ? descriptionLines.slice(0, 4)
          : ["Consulta os detalhes e candidata-te no site da entidade."],
    responsibilities:
      descriptionLines.slice(0, 5).length > 0
        ? descriptionLines.slice(0, 5)
        : ["Consultar descrição completa na página da entidade."],
    applicationUrl: job.applicationUrl,
    salary: job.salary,
  };
}

// Cache em memória do ficheiro (2.5 MB+) para não reler/parsear em cada pedido.
// Invalida automaticamente quando o mtime do jobs.json muda (scrape/admin).
let jobsCache: { mtimeMs: number; file: JobsFile } | null = null;

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
    return file;
  } catch {
    return { updatedAt: new Date(0).toISOString(), jobs: [] };
  }
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

export async function getStoredJobBySlug(slug: string) {
  const published = await listStoredJobs("published");
  const normalized = slugify(slug);
  const matchPublished =
    published.find((job) => job.slug === slug) ||
    published.find(
      (job) => job.slug === normalized || slugify(job.slug) === normalized,
    );
  if (matchPublished) return matchPublished;
  return null;
}

export async function getStoredJobBySlugIncludingExpired(slug: string) {
  const published = await getStoredJobBySlug(slug);
  if (published) {
    if (isPastExpiry(published)) {
      return { job: published, expired: true as const };
    }
    return { job: published, expired: false as const };
  }

  const all = await listAllStoredJobs();
  const normalized = slugify(slug);
  const match =
    all.find((job) => job.slug === slug) ||
    all.find(
      (job) => job.slug === normalized || slugify(job.slug) === normalized,
    );
  if (!match) return null;
  if (match.status === "expired" || isPastExpiry(match)) {
    return { job: match, expired: true as const };
  }
  if (match.status === "published") {
    return { job: match, expired: false as const };
  }
  return null;
}

function isPastExpiry(job: StoredJob) {
  if (!job.expiresAt) return false;
  const expires = Date.parse(job.expiresAt);
  return !Number.isNaN(expires) && expires < Date.now();
}

export async function listJobCards() {
  const jobs = await listStoredJobs("published");
  return jobs
    .filter((job) => !isPastExpiry(job) && !isClosedNoticeTitle(job.title))
    .map(toJobCard)
    .sort((a, b) => {
      // Anúncios mais recentes primeiro (não updatedAt de re-scrape).
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "pt");
    });
}

function isClosedNoticeTitle(title: string) {
  const t = normalize(title);
  return (
    t.includes("lista de classificacao") ||
    t.includes("lista de ordenacao") ||
    t.includes("homologacao da lista") ||
    t.includes("classificacao final")
  );
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
    const title = item.title?.trim();
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
    // Sempre a partir do título — sem fallback para a categoria actual.
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
