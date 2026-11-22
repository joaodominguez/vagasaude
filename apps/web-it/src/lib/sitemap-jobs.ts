import type { Job } from "@/lib/jobs";
import { getJobs } from "@/lib/jobs-data";
import { dedupeBySlug, pickLastmod } from "@/lib/lastmod";
import { isSitemapJob } from "@/lib/indexable";
import { classifyJob } from "@/lib/job-type";
import { listClosedCards } from "@/lib/job-store";
import { expiredConcorsoClosure } from "@/lib/expired-concorso";

/**
 * Offerte del jobs.xml (e, per trascinamento, di Indexing API e IndexNow, che leggono questo sitemap).
 * Le graduatorie non sono offerte di lavoro (la pagina non ha JobPosting): restano fuori dal sitemap e quindi dalla
 * Indexing API, che Google riserva ai JobPosting. Sono raggiungibili da /concorsi/tipo/graduatorie.
 */
export async function listSitemapJobs(now: number = Date.now()): Promise<Job[]> {
  // Uma voce per slug (A3): prima si deduplica sull'insieme completo (e' la scheda che la pagina mostra), poi si filtra.
  return dedupeBySlug(await getJobs()).filter((job) => isSitemapJob(job, now) && classifyJob(job) !== "graduatoria");
}

/** lastmod di un'offerta: la pubblicazione; senza data valida, la 1a volta vista; mai «adesso». */
export function jobLastmod(job: Job, now: number = Date.now()): Date | null {
  return pickLastmod([job.publishedAt, job.firstSeenAt], now);
}

/**
 * Professioni cliniche (le piu' cercate e quelle che pesano di piu' per Google for Jobs).
 * Fuori: Gestione e supporto, Amministrativo, Servizio sociale, Ottica e audiometria, Veterinaria.
 */
const CLINICAL_PROFESSIONS = new Set([
  "Medicina",
  "Infermieristica",
  "OSS",
  "Tecnici sanitari",
  "Fisioterapia",
  "Logopedia e riabilitazione",
  "Farmacia",
  "Psicologia",
  "Ostetricia",
  "Nutrizione e dietistica",
  "Odontoiatria",
]);

export function isClinicalJob(job: Pick<Job, "profession">): boolean {
  return CLINICAL_PROFESSIONS.has(job.profession);
}

/** Agenzie di somministrazione (Randstad): stesse offerte che le agenzie pubblicano ovunque, priorita' bassa. */
const AGENCY_SOURCES = new Set(["randstad"]);

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Metadati per la coda della Indexing API/IndexNow (tools/indexing_notify.py): solo dati gia' pubblici
 * nella pagina. siblings = n. di offerte del sitemap con stessa azienda+titolo+citta' (1 = unica);
 * sourceCount = offerte del sitemap della stessa fonte; sector = pubblico/privato; agency = agenzia.
 */
export function buildJobsMeta(jobs: Job[], siteUrl: string, now: number = Date.now()) {
  const keyOf = (job: Job) =>
    `${normalizeKey(job.company)}|${normalizeKey(job.title)}|${normalizeKey(job.city)}`;
  const siblings = new Map<string, number>();
  const sources = new Map<string, number>();
  for (const job of jobs) {
    siblings.set(keyOf(job), (siblings.get(keyOf(job)) ?? 0) + 1);
    const source = job.source ?? "";
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }
  return jobs.map((job) => ({
    url: `${siteUrl}/offerte/${job.slug}`,
    lastmod: (jobLastmod(job, now) ?? new Date(now)).toISOString(),
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt ?? null,
    lastSeenAt: job.lastSeenAt ?? null,
    expiresAt: job.expiresAt ?? null,
    source: job.source ?? "",
    profession: job.profession,
    district: job.district,
    sector: job.sector,
    clinical: isClinicalJob(job),
    agency: AGENCY_SOURCES.has(job.source ?? ""),
    siblings: siblings.get(keyOf(job)) ?? 1,
    sourceCount: sources.get(job.source ?? "") ?? 1,
  }));
}

/**
 * URL dei concorsi pubblici scaduti da <= 90 giorni: pagine indicizzabili (index,follow, senza JobPosting)
 * fuori dal jobs.xml. Indexing API e IndexNow NON devono mandare URL_DELETED/rimozioni per questi URL;
 * tools/indexing_notify.py li notifica una volta come URL_UPDATED.
 */
export async function listExpiredIndexableUrls(siteUrl: string, now: number = Date.now()): Promise<string[]> {
  const closed = await listClosedCards();
  return closed
    .filter(({ job, closure }) => expiredConcorsoClosure(job, closure, now) != null)
    .map(({ job }) => `${siteUrl}/offerte/${job.slug}`)
    .sort();
}
