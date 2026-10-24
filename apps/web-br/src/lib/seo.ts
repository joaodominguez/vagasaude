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

/**
 * employmentType a partir do texto de contrato da fonte (pode ter vários:
 * "Termo certo · A tempo completo" → TEMPORARY + FULL_TIME). "Contrato" sozinho
 * é ambíguo (não é prestação de serviços) e fica OTHER.
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
  if (/prestacao de servicos|recibos? verdes?|\bpj\b|freelanc/.test(text)) types.add("CONTRACTOR");
  if (/estagi[oa]|\binternship/.test(text)) types.add("INTERN");
  if (/termo (?:certo|incerto)|a termo|temporari|\bpss\b|substitui/.test(text)) types.add("TEMPORARY");
  if (/plantao|plantonista/.test(text)) types.add("PER_DIEM");
  if (/tempo parcial|part[ -]?time|meio periodo/.test(text)) types.add("PART_TIME");
  if (
    /tempo (?:inteiro|completo|integral)|full[ -]?time|\bclt\b|sem termo|tempo indeterminado|definitiv|\bctfp\b|\b3[5-9] horas|\b40 horas/.test(text) &&
    !types.has("PART_TIME")
  ) {
    types.add("FULL_TIME");
  }
  if (types.size === 0) return "OTHER";
  const list = [...types];
  return list.length === 1 ? list[0] : list;
}

/** Dias de validade a partir da última vez que a fonte devolveu a vaga. */
const VALID_THROUGH_DAYS_AFTER_SEEN = 30;

/**
 * validThrough: data de fim da fonte se for futura; senão última vez vista
 * pelo scraper + 30 dias. Uma vaga que deixa de aparecer na fonte expira e
 * sai do JobPosting, por isso nunca fica com datas no passado.
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

/** publishedAt já vem normalizado do job-store (nunca a hora do pedido). */
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
    ? `${job.title} (vaga encerrada) — ${job.company}`
    : `${job.title} — ${job.company}`;
  const description = expired
    ? truncateMeta(
        `Esta vaga de ${job.profession} em ${job.city} já não está ativa. Explore ofertas semelhantes de saúde no VagaSaúde.`,
        160,
      )
    : jobMetaDescription(job);
  const url = jobPath(job.slug);
  // Republicação: canonical para a vaga principal (a cópia sai do índice).
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
  const validThrough = jobValidThrough(job);
  const description =
    [job.description, ...job.requirements, ...job.responsibilities]
      .filter(Boolean)
      .join("\n\n")
      .trim() ||
    // Google exige description não vazio (JobPosting).
    `${job.title} — ${job.company}${job.city ? ` em ${job.city}` : ""}. Candidatura no site da entidade.`;
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
      address: buildJobPostalAddress(job),
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
    inLanguage: "pt-BR",
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
