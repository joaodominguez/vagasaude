import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://offertesanita.it";

/** Nome del brand (da confermare con il proprietario). */
export const SITE_NAME = "Offerte Sanità";

export const DEFAULT_DESCRIPTION =
  "Offerte di lavoro nella sanità in Italia: infermieri, medici, OSS, fisioterapisti e altre professioni sanitarie. Pubblico, privato e accreditato in un unico posto: cerca e candidati.";

export const HOME_TITLE = `${SITE_NAME} — Lavoro nella sanità in Italia`;

export const HOME_DESCRIPTION = DEFAULT_DESCRIPTION;

export function buildHomeMetadata(jobCount?: number): Metadata {
  const countLine =
    typeof jobCount === "number" && jobCount > 0
      ? ` Oltre ${jobCount} offerte attive.`
      : "";
  const description = truncateMeta(`${HOME_DESCRIPTION}${countLine}`, 160);
  const title = HOME_TITLE;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      url: "/",
      type: "website",
      siteName: SITE_NAME,
      locale: "it_IT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function truncateMeta(text: string, max = 155) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function jobPath(slug: string) {
  return `/offerte/${slug}`;
}

export function jobUrl(slug: string) {
  return absoluteUrl(jobPath(slug));
}

export function jobMetaDescription(job: Job) {
  const snippet = truncateMeta(job.description, 110);
  return truncateMeta(
    `${job.title} a ${job.city} · ${job.company}. ${snippet}`,
    160,
  );
}

/**
 * employmentType dal testo del contratto della fonte (possono essercene piu':
 * "Tempo determinato · Full-time" -> TEMPORARY + FULL_TIME). "Contratto" da solo
 * e' ambiguo e resta OTHER.
 */
export function mapEmploymentType(
  contract: string | null | undefined,
): string | string[] {
  if (!contract) return "OTHER";
  const text = contract
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const types = new Set<string>();
  if (/libero profession|libera profession|partita iva|\bp\.? ?iva\b|consulenza|co\.?co\.?co|collaborazione|freelanc/.test(text)) types.add("CONTRACTOR");
  if (/tirocinio|\bstage\b|internship|apprendistato/.test(text)) types.add("INTERN");
  if (/(?<!in)determinat|sostituzion|supplenza|maternita|stagional|interinale|somministrazione/.test(text)) types.add("TEMPORARY");
  if (/\bguardi[ae]\b|\bad ore\b|\bturni\b|\bturnista\b/.test(text)) types.add("PER_DIEM");
  if (/part[ -]?time|tempo parziale|orario ridotto/.test(text)) types.add("PART_TIME");
  if (
    /tempo pieno|full[ -]?time|indeterminat|\bdi ruolo\b|\bin ruolo\b|\b3[5-9] ore|\b40 ore/.test(text) &&
    !types.has("PART_TIME")
  ) {
    types.add("FULL_TIME");
  }
  if (types.size === 0) return "OTHER";
  const list = [...types];
  return list.length === 1 ? list[0] : list;
}

/** Giorni di validita dall'ultima volta che la fonte ha restituito l'offerta. */
const VALID_THROUGH_DAYS_AFTER_SEEN = 30;

/**
 * validThrough: data di scadenza della fonte se futura; altrimenti ultima volta
 * vista dallo scraper + 30 giorni. Un'offerta che sparisce dalla fonte scade
 * ed esce dal JobPosting, quindi non resta mai con date passate.
 */
export function jobValidThrough(job: Job) {
  if (job.expiresAt) {
    const expires = new Date(job.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() > Date.now()) {
      return expires.toISOString();
    }
  }
  const seen = new Date(job.lastSeenAt || Date.now());
  const base = Number.isNaN(seen.getTime()) || seen.getTime() > Date.now() ? new Date() : seen;
  const expires = new Date(base);
  expires.setUTCDate(expires.getUTCDate() + VALID_THROUGH_DAYS_AFTER_SEEN);
  return expires.toISOString();
}

/** publishedAt arriva gia normalizzato dal job-store (mai l'ora della richiesta). */
export function safeDatePosted(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return undefined;
  return date.toISOString();
}

export function buildJobMetadata(
  job: Job,
  options?: { expired?: boolean; canonicalSlug?: string },
): Metadata {
  const expired = Boolean(options?.expired);
  const title = expired
    ? `${job.title} (offerta chiusa) — ${job.company}`
    : `${job.title} — ${job.company}`;
  const description = expired
    ? truncateMeta(
        `Questa offerta di ${job.profession} a ${job.city} non è più attiva. Scopri offerte sanitarie simili su ${SITE_NAME}.`,
        160,
      )
    : jobMetaDescription(job);
  const url = jobPath(job.slug);
  // Ripubblicazione: canonical verso l'offerta principale (la copia esce dall'indice).
  const canonical = jobPath(options?.canonicalSlug || job.slug);

  return {
    title,
    description,
    alternates: { canonical },
    robots: expired
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      locale: "it_IT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** "1.499,15" / "1499.15" / "25.000" -> numero (formato it-IT). */
function parseEuroAmount(raw: string) {
  let value = raw.trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Retribuzione indicata nella fonte (es.: "1.230 €/mese", "Da 25.000€ a 35.000€ lordi/anno").
 * Non inventa valori: restituisce null se non c'e' un importo in euro.
 */
export function parseAnnouncedSalary(salary: string | null | undefined): {
  currency: "EUR";
  unitText: "HOUR" | "DAY" | "MONTH" | "YEAR";
  value?: number;
  minValue?: number;
  maxValue?: number;
} | null {
  if (!salary?.trim()) return null;
  const text = salary.trim();
  const amounts = [
    ...text.matchAll(/(\d[\d.,]*)\s*(?:€|eur(?:o)?\b)|€\s*(\d[\d.,]*)/gi),
  ]
    .map((match) => parseEuroAmount(match[1] || match[2] || ""))
    .filter((n): n is number => n != null);
  if (amounts.length === 0) return null;
  const lower = text.toLowerCase();
  let unitText: "HOUR" | "DAY" | "MONTH" | "YEAR" = "MONTH";
  if (/\/\s*h\b|all'ora|orari[oa]|€\/ora|euro\/ora|l\/h\b/.test(lower)) unitText = "HOUR";
  else if (/\/\s*giorn|giornalier|al giorno|\/\s*die\b/.test(lower)) unitText = "DAY";
  else if (/\/\s*anno|annu[ao]|\bral\b|lordi?\/anno|\bl\.?o\.?\/anno/.test(lower) || Math.min(...amounts) >= 10000) unitText = "YEAR";
  if (amounts.length >= 2) {
    return {
      currency: "EUR",
      unitText,
      minValue: Math.min(...amounts),
      maxValue: Math.max(...amounts),
    };
  }
  return { currency: "EUR", unitText, value: amounts[0] };
}

function buildBaseSalaryJsonLd(job: Job) {
  const parsed = parseAnnouncedSalary(job.salary);
  if (!parsed) return undefined;
  const value: Record<string, string | number> = {
    "@type": "QuantitativeValue",
    unitText: parsed.unitText,
  };
  if (parsed.minValue != null && parsed.maxValue != null) {
    value.minValue = parsed.minValue;
    value.maxValue = parsed.maxValue;
  } else if (parsed.value != null) {
    value.value = parsed.value;
  } else {
    return undefined;
  }
  return { "@type": "MonetaryAmount", currency: parsed.currency, value };
}

export function buildJobPostingJsonLd(job: Job) {
  const datePosted = safeDatePosted(job.publishedAt);
  const validThrough = jobValidThrough(job);
  const description = [job.description, ...job.requirements, ...job.responsibilities]
    .filter(Boolean)
    .join("\n\n");
  const baseSalary = buildBaseSalaryJsonLd(job);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    ...(datePosted ? { datePosted } : {}),
    ...(validThrough ? { validThrough } : {}),
    employmentType: mapEmploymentType(job.contract),
    occupationalCategory: job.profession,
    industry: "Healthcare",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city || job.district,
        addressRegion: job.district,
        addressCountry: "IT",
      },
    },
    ...(baseSalary ? { baseSalary } : {}),
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: job.sourceId || job.slug,
    },
    url: jobUrl(job.slug),
    directApply: false,
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "it-IT",
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    description: DEFAULT_DESCRIPTION,
  };
}
