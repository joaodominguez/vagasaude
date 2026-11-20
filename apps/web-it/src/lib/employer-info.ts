/**
 * Arricchimento delle pagine azienda (/aziende/[slug]): tipo di ente, regione, link ufficiale
 * "lavora con noi / bandi", archivio dei bandi scaduti di recente e scadenze imminenti.
 * Tutto deriva dalle offerte e dalle fonti note: niente dati inventati.
 */
import { cache } from "react";
import type { Job } from "@/lib/jobs";
import { toCategorySlug } from "@/lib/categories";
import { displayTitle } from "@/lib/display-title";
import { daysUntilDeadline } from "@/lib/job-display";
import { decodeHtmlEntities, listAllStoredJobs } from "@/lib/job-store";
import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { JOB_SOURCES } from "@/lib/sources";

export type EntityKind =
  | "ASL"
  | "ASST"
  | "AO"
  | "AOU"
  | "IRCCS"
  | "REGIONALE"
  | "RSA"
  | "AGENZIA"
  | "PRIVATO";

export type EntityType = { kind: EntityKind; short: string; label: string };

const TYPES: Record<EntityKind, EntityType> = {
  ASL: { kind: "ASL", short: "ASL", label: "Azienda sanitaria locale (ASL/AUSL/ULSS/ASP/AST)" },
  ASST: { kind: "ASST", short: "ASST", label: "Azienda socio-sanitaria territoriale (ASST)" },
  AO: { kind: "AO", short: "AO", label: "Azienda ospedaliera (AO/ARNAS)" },
  AOU: { kind: "AOU", short: "AOU", label: "Azienda ospedaliero-universitaria (AOU)" },
  IRCCS: { kind: "IRCCS", short: "IRCCS", label: "Istituto di ricovero e cura a carattere scientifico (IRCCS)" },
  REGIONALE: { kind: "REGIONALE", short: "Ente regionale", label: "Ente o azienda regionale di coordinamento sanitario" },
  RSA: { kind: "RSA", short: "RSA", label: "Residenza per anziani / servizi alla persona" },
  AGENZIA: { kind: "AGENZIA", short: "Agenzia", label: "Agenzia per il lavoro" },
  PRIVATO: { kind: "PRIVATO", short: "Privato", label: "Struttura sanitaria privata" },
};

const RSA_PRIVATE_RE = /\bkos\b|anni azzurri|santo stefano|clariane|korian|\brsa\b|residenz/i;

/** Tipo di ente dal nome e dal settore (euristica su sigle e denominazioni ufficiali). */
export function entityType(name: string, publicSector: boolean): EntityType {
  const n = name.toLowerCase();
  if (/agenzia per il lavoro/.test(n) || /randstad/.test(n)) return TYPES.AGENZIA;
  if (!publicSector) {
    if (/irccs/.test(n)) return TYPES.IRCCS;
    return RSA_PRIVATE_RE.test(n) ? TYPES.RSA : TYPES.PRIVATO;
  }
  if (/\bares\b|estar|\barcs\b|azienda zero|governo della sanit|coordinamento per la salute|azienda regionale della salute/.test(n)) {
    return TYPES.REGIONALE;
  }
  if (/casa di riposo|casa di soggiorno|ipab|i\.p\.a\.b|pensionato|centro servizi|centro residenziale|casa albergo|servizi alla persona|c\.a\.s\.a|altavita|la quiete|istituto bon bozzolla|asp\b/.test(n) && !/azienda sanitaria provinciale/.test(n)) {
    return TYPES.RSA;
  }
  if (/irccs|istituto di ricovero e cura a carattere scientifico|istituto giannina gaslini|istituto nazionale dei tumori/.test(n)) return TYPES.IRCCS;
  if (/socio[- ]sanitaria territoriale|\basst\b/.test(n)) return TYPES.ASST;
  if (/ospedaliero[- ]universitaria|ospedaliera universitaria|\baou\b|policlinico universitario/.test(n)) return TYPES.AOU;
  if (/azienda ospedaliera|\barnas\b|a\.r\.n\.a\.s|ospedali riuniti|ospedale|azienda ospedaliera/.test(n)) return TYPES.AO;
  if (/sanitaria|sanit[aà] locale|usl|ulss|unit[aà] (locale )?socio|unit[aà] sanitaria|agenzia di tutela della salute|\bats\b|\basl\b|\basp\b/.test(n)) {
    return TYPES.ASL;
  }
  return TYPES.AO;
}

/** Regione principale (la più frequente) e numero di regioni coperte. */
export function employerRegions(jobs: Job[]) {
  const counts = new Map<string, number>();
  for (const job of jobs) if (job.district) counts.set(job.district, (counts.get(job.district) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));
  return { main: list[0]?.[0] ?? null, count: list.length };
}

/** Fonti che aggregano molti enti: non sono il sito dell'azienda. */
const AGGREGATOR_SOURCES = new Set(["inpa", "gu-s4", "randstad", "veneto-concorsi"]);

/**
 * Pagina ufficiale "lavora con noi / bandi" dell'ente, quando la conosciamo dalle nostre fonti
 * (solo fonti proprie dell'ente, mai aggregatori). Altrimenti null.
 */
export function officialJobsLink(jobs: Job[]): { url: string; label: string } | null {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const source = job.source?.toLowerCase();
    if (!source || AGGREGATOR_SOURCES.has(source)) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const meta = best ? JOB_SOURCES.find((s) => s.id === best) : null;
  if (!meta) return null;
  return {
    url: meta.url,
    label: meta.sector === "Pubblico" ? "Concorsi e avvisi sul sito ufficiale" : "Lavora con noi sul sito ufficiale",
  };
}

export type ArchiveItem = {
  slug: string;
  title: string;
  publishedAt: string | null;
  closedAt: string | null;
  kind: string;
};

export const ARCHIVE_DAYS = 120;
export const ARCHIVE_SHOWN = 12;

/** Bandi scaduti di recente (stesso ente): solo titolo, date e link; mai JobPosting. */
export const getEmployerArchive = cache(async (slug: string): Promise<{ items: ArchiveItem[]; total: number }> => {
  const stored = await listAllStoredJobs();
  const cutoff = Date.now() - ARCHIVE_DAYS * 86_400_000;
  const rows: Array<ArchiveItem & { sort: number }> = [];
  for (const job of stored) {
    if (job.status !== "expired") continue;
    if (toCategorySlug(decodeHtmlEntities(job.company || "")) !== slug) continue;
    // Solo bandi con scadenza realmente passata (o senza scadenza, chiusi per mancata riconferma dalla fonte):
    // una scadenza futura su un bando ritirato dalla fonte non è un «bando scaduto».
    const deadline = job.expiresAt ? Date.parse(job.expiresAt) : NaN;
    if (!Number.isNaN(deadline) && deadline > Date.now()) continue;
    const closed = Date.parse(job.expiresAt || job.lastSeenAt || job.updatedAt || "");
    if (Number.isNaN(closed) || closed < cutoff || closed > Date.now()) continue;
    const title = displayTitle(decodeHtmlEntities(job.title), {
      company: job.company,
      city: job.locationConcelho,
      district: job.locationDistrict,
    });
    const kind = job.sector === "pubblico"
      ? JOB_TYPE_LABEL[classifyJob({ title: job.title, description: job.description, sector: "Pubblico", source: job.source })]
      : "Offerta di lavoro";
    rows.push({
      slug: job.slug,
      title,
      publishedAt: job.publishedAt,
      closedAt: job.expiresAt || job.lastSeenAt || job.updatedAt || null,
      kind,
      sort: closed,
    });
  }
  rows.sort((a, b) => b.sort - a.sort);
  return { items: rows.slice(0, ARCHIVE_SHOWN).map(({ sort: _s, ...item }) => item), total: rows.length };
});

/** Offerte attive con scadenza entro `days` giorni, dalla più vicina. */
export function upcomingDeadlines(jobs: Job[], days = 30, now = Date.now()) {
  return jobs
    .filter((job) => {
      const left = daysUntilDeadline(job.expiresAt, now);
      return left !== null && left >= 0 && left <= days;
    })
    .sort((a, b) => Date.parse(a.expiresAt as string) - Date.parse(b.expiresAt as string));
}

/** Procedure pubbliche aperte (concorso, avviso, mobilità...) come ConcorsoItem, per typeBreakdownText. */
export function employerProcedures(jobs: Job[]) {
  return jobs
    .map((job) => ({ job, type: classifyJob(job) }))
    .filter((item) => item.type !== "offerta");
}
