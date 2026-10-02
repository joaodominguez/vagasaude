import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vagasaude.com.br";

export const SITE_NAME = "VagaSaúde";

export const DEFAULT_DESCRIPTION =
  "Vagas de saúde no Brasil: enfermagem, medicina, fisioterapia e mais. Público, privado e filantrópico em um só site — pesquise e candidate-se.";

export const HOME_TITLE = `${SITE_NAME} — Vagas de saúde no Brasil`;

export const HOME_DESCRIPTION = DEFAULT_DESCRIPTION;

export function buildHomeMetadata(jobCount?: number): Metadata {
  const countLine =
    typeof jobCount === "number" && jobCount > 0
      ? ` Mais de ${jobCount} ofertas ativas.`
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
      locale: "pt_BR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  clt: "FULL_TIME",
  "tempo inteiro": "FULL_TIME",
  "full time": "FULL_TIME",
  "full-time": "FULL_TIME",
  "meio periodo": "PART_TIME",
  "meio período": "PART_TIME",
  "tempo parcial": "PART_TIME",
  "part time": "PART_TIME",
  "part-time": "PART_TIME",
  estágio: "INTERN",
  estagio: "INTERN",
  temporário: "TEMPORARY",
  temporario: "TEMPORARY",
  pj: "CONTRACTOR",
  "prestação de serviços": "CONTRACTOR",
  "prestacao de servicos": "CONTRACTOR",
  contrato: "CONTRACTOR",
  plantão: "OTHER",
  plantao: "OTHER",
  turnos: "OTHER",
};

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
  return `/vagas/${slug}`;
}

export function jobUrl(slug: string) {
  return absoluteUrl(jobPath(slug));
}

export function jobMetaDescription(job: Job) {
  const snippet = truncateMeta(job.description, 110);
  return truncateMeta(
    `${job.title} em ${job.city} · ${job.company}. ${snippet}`,
    160,
  );
}

export function mapEmploymentType(contract: string | null | undefined) {
  if (!contract) return "OTHER";
  const key = contract
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return EMPLOYMENT_TYPE_MAP[key] ?? "OTHER";
}

export function jobValidThrough(job: Job, datePostedIso?: string) {
  if (job.expiresAt) {
    const expires = new Date(job.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() > Date.now()) {
      return expires.toISOString();
    }
  }
  const posted = new Date(datePostedIso || job.publishedAt);
  if (Number.isNaN(posted.getTime())) return undefined;
  const base = posted.getTime() > Date.now() ? new Date() : posted;
  const expires = new Date(base);
  expires.setUTCDate(expires.getUTCDate() + 60);
  return expires.toISOString();
}

export function safeDatePosted(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  if (date.getTime() > Date.now()) return new Date().toISOString();
  return date.toISOString();
}

export function buildJobMetadata(
  job: Job,
  options?: { expired?: boolean },
): Metadata {
  const expired = Boolean(options?.expired);
  const title = expired
    ? `${job.title} (vaga encerrada) — ${job.company}`
    : `${job.title} — ${job.company}`;
  const description = expired
    ? truncateMeta(
        `Esta vaga de ${job.profession} em ${job.city} já não está ativa. Explore ofertas semelhantes de saúde no VagaSaúde.`,
        160,
      )
    : jobMetaDescription(job);
  const url = jobPath(job.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: expired
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      locale: "pt_BR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Parse remuneração anunciada (ex.: "R$ 5.200 / mês", "R$ 3.000 – R$ 4.500").
 * Não inventa valores — devolve null se não houver montante parseável.
 */
export function parseAnnouncedSalary(salary: string | null | undefined): {
  currency: "BRL";
  unitText: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
  value?: number;
  minValue?: number;
  maxValue?: number;
} | null {
  if (!salary?.trim()) return null;
  const text = salary.trim();
  const amounts = [...text.matchAll(/R\$\s*([\d.]+(?:,\d+)?)/gi)]
    .map((match) => {
      const raw = match[1].replace(/\./g, "").replace(",", ".");
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })
    .filter((n): n is number => n != null);
  if (amounts.length === 0) return null;

  const lower = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let unitText: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" = "MONTH";
  if (/\b(hora|horas|\/\s*h\b|por hora)\b/.test(lower)) unitText = "HOUR";
  else if (/\b(dia|diaria|\/\s*dia|por dia)\b/.test(lower)) unitText = "DAY";
  else if (/\b(semana|semanal|\/\s*semana)\b/.test(lower)) unitText = "WEEK";
  else if (/\b(ano|anual|\/\s*ano)\b/.test(lower)) unitText = "YEAR";

  if (amounts.length >= 2) {
    return {
      currency: "BRL",
      unitText,
      minValue: Math.min(...amounts),
      maxValue: Math.max(...amounts),
    };
  }
  return { currency: "BRL", unitText, value: amounts[0] };
}

function buildJobPostalAddress(job: Job) {
  // Só cidade/UF/país — sem postalCode/streetAddress inventados.
  // GSC pode continuar a avisar estes campos recomendados sem dados reais.
  const address: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: "BR",
  };
  const locality = (job.city || job.district || "").trim();
  const region = (job.district || "").trim();
  if (locality) address.addressLocality = locality;
  if (region) address.addressRegion = region;

  const extra = job as Job & {
    postalCode?: string | null;
    streetAddress?: string | null;
  };
  const postalCode = extra.postalCode?.trim();
  const streetAddress = extra.streetAddress?.trim();
  if (postalCode) address.postalCode = postalCode;
  if (streetAddress) address.streetAddress = streetAddress;
  return address;
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
  return {
    "@type": "MonetaryAmount",
    currency: parsed.currency,
    value,
  };
}

export function buildJobPostingJsonLd(job: Job) {
  const datePosted = safeDatePosted(job.publishedAt);
  const validThrough = jobValidThrough(job, datePosted);
  const description = [job.description, ...job.requirements, ...job.responsibilities]
    .filter(Boolean)
    .join("\n\n");
  const baseSalary = buildBaseSalaryJsonLd(job);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    datePosted,
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
      address: buildJobPostalAddress(job),
    },
    ...(baseSalary ? { baseSalary } : {}),
    identifier: {
      "@type": "PropertyValue",
      name: SITE_NAME,
      value: job.slug,
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
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/vagas?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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
