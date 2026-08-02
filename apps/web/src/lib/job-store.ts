import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationUrl: string;
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

export function makeDedupeHash(title: string, company: string, district: string) {
  return createHash("sha256")
    .update(`${normalize(title)}|${normalize(company)}|${normalize(district)}`)
    .digest("hex");
}

export function slugify(text: string) {
  return normalize(text).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
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
  };
}

async function readJobsFile(): Promise<JobsFile> {
  try {
    const raw = await readFile(jobsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as JobsFile;
    return {
      updatedAt: parsed.updatedAt,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { updatedAt: new Date(0).toISOString(), jobs: [] };
  }
}

async function writeJobsFile(file: JobsFile) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(jobsFilePath(), JSON.stringify(file, null, 2), { mode: 0o600 });
}

export async function listStoredJobs(status: StoredJob["status"] = "published") {
  const file = await readJobsFile();
  return file.jobs
    .filter((job) => job.status === status)
    .sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.localeCompare(aDate);
    });
}

export async function getStoredJobBySlug(slug: string) {
  const jobs = await listStoredJobs("published");
  return jobs.find((job) => job.slug === slug) ?? null;
}

export async function listJobCards() {
  const jobs = await listStoredJobs("published");
  return jobs.map(toJobCard);
}

export async function getJobCard(slug: string) {
  const job = await getStoredJobBySlug(slug);
  return job ? toJobCard(job) : null;
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
    const incomplete =
      !description ||
      description.length < 40 ||
      !item.profession?.trim();

    let status: StoredJob["status"] =
      item.status || (incomplete ? "pending_review" : "published");
    let reviewReason = item.review_reason || null;

    if (!existingSameSource && existingHash && existingHash.source !== source) {
      status = "duplicate";
      reviewReason = `Duplicado de ${existingHash.source}:${existingHash.sourceId}`;
    }

    if (status === "pending_review") review += 1;

    const slugBase = `${slugify(title)}-${slugify(company)}-${sourceId}`.slice(0, 100);
    const next: StoredJob = {
      id: existingSameSource?.id || crypto.randomUUID(),
      slug: existingSameSource?.slug || slugBase,
      title,
      company,
      locationDistrict: district,
      locationConcelho: item.location_concelho?.trim() || null,
      profession: item.profession?.trim() || "Outros",
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

export async function getJobStats() {
  const file = await readJobsFile();
  const published = file.jobs.filter((job) => job.status === "published");
  const bySource = published.reduce<Record<string, number>>((acc, job) => {
    acc[job.source] = (acc[job.source] || 0) + 1;
    return acc;
  }, {});
  return {
    updatedAt: file.updatedAt,
    published: published.length,
    pendingReview: file.jobs.filter((job) => job.status === "pending_review").length,
    bySource,
  };
}
