import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { enLugar } from "@/lib/es-locative";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vacantessalud.es";

/** Nombre propuesto (pendiente de confirmar por el propietario). */
export const SITE_NAME = "VacantesSalud";

export const DEFAULT_DESCRIPTION =
  "Ofertas de empleo sanitario en España: enfermería, medicina, TCAE, fisioterapia y más. Público, privado y concertado en un solo sitio: busca e inscríbete.";

export const HOME_TITLE = `${SITE_NAME} — Empleo sanitario en España`;

export const HOME_DESCRIPTION = DEFAULT_DESCRIPTION;

export function buildHomeMetadata(jobCount?: number): Metadata {
  const countLine =
    typeof jobCount === "number" && jobCount > 0
      ? ` Más de ${jobCount} ofertas activas.`
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
      locale: "es_ES",
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
  return `/empleo/${slug}`;
}

export function jobUrl(slug: string) {
  return absoluteUrl(jobPath(slug));
}

export function jobMetaDescription(job: Job) {
  const snippet = truncateMeta(job.description, 110);
  return truncateMeta(
    `${job.title} ${enLugar(job.city)} · ${job.company}. ${snippet}`,
    160,
  );
}

/**
 * employmentType a partir del texto de contrato de la fuente (puede haber varios:
 * "Temporal · Jornada completa" → TEMPORARY + FULL_TIME). "Contrato" solo es
 * ambiguo y queda en OTHER.
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
  if (/autonomo|prestacion de servicios|freelanc|\bfactura\b/.test(text)) types.add("CONTRACTOR");
  if (/practicas|\bbeca\b|becario|internship/.test(text)) types.add("INTERN");
  if (/temporal|interin|eventual|obra y servicio|sustitu|suplenci|duracion determinada|\bverano\b/.test(text)) types.add("TEMPORARY");
  if (/guardias?\b|\bpor horas\b/.test(text)) types.add("PER_DIEM");
  if (/media jornada|jornada parcial|tiempo parcial|part[ -]?time|jornada reducida/.test(text)) types.add("PART_TIME");
  if (
    /jornada completa|tiempo completo|full[ -]?time|indefinid|\bfijo\b|fijo discontinuo|\bplaza en propiedad|\b3[5-9] horas|\b40 horas/.test(text) &&
    !types.has("PART_TIME")
  ) {
    types.add("FULL_TIME");
  }
  if (types.size === 0) return "OTHER";
  const list = [...types];
  return list.length === 1 ? list[0] : list;
}

/** Días de validez desde la última vez que la fuente devolvió la oferta. */
const VALID_THROUGH_DAYS_AFTER_SEEN = 30;

/**
 * validThrough: fecha de fin de la fuente si es futura; si no, última vez vista
 * por el scraper + 30 días. Una oferta que deja de aparecer en la fuente caduca
 * y sale del JobPosting, así que nunca queda con fechas pasadas.
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

/** publishedAt ya viene normalizado del job-store (nunca la hora de la petición). */
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
    ? `${job.title} (oferta cerrada) — ${job.company}`
    : `${job.title} — ${job.company}`;
  const description = expired
    ? truncateMeta(
        `Esta oferta de ${job.profession} ${enLugar(job.city)} ya no está activa. Explora ofertas sanitarias parecidas en ${SITE_NAME}.`,
        160,
      )
    : jobMetaDescription(job);
  const url = jobPath(job.slug);
  // Republicación: canonical hacia la oferta principal (la copia sale del índice).
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
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** "1.499,15" / "1499.15" / "25.000" → número (formato es-ES). */
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
 * Retribución anunciada (ej.: "1.230 €/mes", "De 25.000€ a 35.000€ brutos/año").
 * No inventa valores: devuelve null si no hay importe en euros.
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
    ...text.matchAll(/(\d[\d.,]*)\s*(?:€|eur(?:os)?\b)|€\s*(\d[\d.,]*)/gi),
  ]
    .map((match) => parseEuroAmount(match[1] || match[2] || ""))
    .filter((n): n is number => n != null);
  if (amounts.length === 0) return null;
  const lower = text.toLowerCase();
  let unitText: "HOUR" | "DAY" | "MONTH" | "YEAR" = "MONTH";
  if (/\/\s*h\b|por hora|€\/hora|euros\/hora/.test(lower)) unitText = "HOUR";
  else if (/\/\s*d[ií]a|diari/.test(lower)) unitText = "DAY";
  else if (/\/\s*a[nñ]o|anual|al a[nñ]o|brutos?\/a[nñ]o/.test(lower) || Math.min(...amounts) >= 10000) unitText = "YEAR";
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
        addressCountry: "ES",
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
    inLanguage: "es-ES",
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
