import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vagasaude.pt";

export const SITE_NAME = "VagaSaúde";

export const DEFAULT_DESCRIPTION =
  "Vagas de saúde em Portugal: enfermagem, medicina, fisioterapia e mais. Público, privado e IPSS num só sítio — pesquisa e candidata-te.";

export const HOME_TITLE = `${SITE_NAME} — Vagas de saúde em Portugal`;

export const HOME_DESCRIPTION = DEFAULT_DESCRIPTION;

export function buildHomeMetadata(jobCount?: number): Metadata {
  const countLine =
    typeof jobCount === "number" && jobCount > 0
      ? ` Mais de ${jobCount} ofertas activas.`
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
      locale: "pt_PT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  "tempo inteiro": "FULL_TIME",
  "full time": "FULL_TIME",
  "full-time": "FULL_TIME",
  "tempo parcial": "PART_TIME",
  "part time": "PART_TIME",
  "part-time": "PART_TIME",
  estágio: "INTERN",
  estagio: "INTERN",
  temporário: "TEMPORARY",
  temporario: "TEMPORARY",
  "prestação de serviços": "CONTRACTOR",
  "prestacao de servicos": "CONTRACTOR",
  contrato: "CONTRACTOR",
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
        `Esta vaga de ${job.profession} em ${job.city} já não está activa. Explora ofertas semelhantes de saúde no VagaSaúde.`,
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
      locale: "pt_PT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function buildJobPostingJsonLd(job: Job) {
  const datePosted = safeDatePosted(job.publishedAt);
  const validThrough = jobValidThrough(job, datePosted);
  const description = [job.description, ...job.requirements, ...job.responsibilities]
    .filter(Boolean)
    .join("\n\n");

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
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city || job.district,
        addressRegion: job.district,
        addressCountry: "PT",
      },
    },
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
    inLanguage: "pt-PT",
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
