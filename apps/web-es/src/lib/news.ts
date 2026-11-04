import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import rehypeStringify from "rehype-stringify";
import { parse as parseYaml } from "yaml";
import { isKnownDistrict, isKnownProfession } from "@/lib/categories";

/** Noticias: archivos Markdown en content/noticias/<slug>.md (solo servidor). */

export const NEWS_CATEGORIES = {
  "mercado-laboral": {
    label: "Mercado laboral",
    description:
      "Informes mensuales y análisis del mercado de empleo sanitario en España, con datos de las ofertas de VacantesSalud.",
  },
  oposiciones: {
    label: "Oposiciones",
    description:
      "Resumen de oposiciones, bolsas de empleo y procesos selectivos para profesionales sanitarios en España.",
  },
  "salarios-y-carreras": {
    label: "Salarios y carreras",
    description:
      "Noticias sobre salarios, tablas retributivas, carrera profesional y condiciones de los profesionales sanitarios.",
  },
  guias: {
    label: "Guías",
    description:
      "Guías prácticas para profesionales sanitarios: currículum, candidaturas, convocatorias y empleo en España.",
  },
} as const;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_PAGE_SIZE = 20;
/** Segmentos de /noticias/* que no se pueden usar como slug. */
const RESERVED_SLUGS = new Set(["categoria", "pagina", "rss.xml"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type NewsSource = { label: string; url: string };

export type NewsArticle = {
  title: string;
  slug: string;
  date: string;
  updated?: string;
  author: string;
  category: NewsCategory;
  summary: string[];
  description: string;
  professions: string[];
  districts: string[];
  sources: NewsSource[];
  draft: boolean;
  image?: string;
  /** Markdown sin procesar (sin frontmatter). */
  body: string;
};

export function isNewsCategory(value: string): value is NewsCategory {
  return Object.prototype.hasOwnProperty.call(NEWS_CATEGORIES, value);
}

export function newsCategoryLabel(category: NewsCategory) {
  return NEWS_CATEGORIES[category].label;
}

export const newsPath = (slug: string) => `/noticias/${slug}`;
export const newsCategoryPath = (category: NewsCategory) =>
  `/noticias/categoria/${category}`;
export const newsPagePath = (page: number) =>
  page <= 1 ? "/noticias" : `/noticias/pagina/${page}`;

function contentDir() {
  return path.join(process.cwd(), "content", "noticias");
}

/** Los borradores nunca existen en producción (build ni runtime). */
function draftsAllowed() {
  return process.env.NODE_ENV !== "production";
}

function fail(file: string, message: string): never {
  throw new Error(`[noticias] ${file}: ${message}`);
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strList(file: string, field: string, value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(file, `"${field}" debe ser una lista`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isoDate(file: string, field: string, value: unknown): string {
  // YAML puede devolver Date; normalizar a YYYY-MM-DD.
  const text =
    value instanceof Date ? value.toISOString().slice(0, 10) : str(value);
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
    fail(file, `"${field}" debe ser una fecha ISO (AAAA-MM-DD)`);
  }
  return text;
}

function parseArticle(filename: string, raw: string): NewsArticle {
  const match = raw.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) fail(filename, "falta el frontmatter YAML (---)");
  let data: Record<string, unknown>;
  try {
    data = (parseYaml(match[1], { schema: "core" }) ?? {}) as Record<string, unknown>;
  } catch (error) {
    return fail(filename, `YAML no válido (${(error as Error).message})`);
  }

  const expectedSlug = filename.replace(/\.md$/, "");
  const slug = str(data.slug);
  if (slug !== expectedSlug) fail(filename, `"slug" debe coincidir con el nombre del archivo (${expectedSlug})`);
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) fail(filename, `slug no válido o reservado: ${slug}`);

  const title = str(data.title);
  if (!title) fail(filename, 'falta "title"');
  const category = str(data.category);
  if (!isNewsCategory(category)) {
    fail(filename, `"category" no válida: ${category || "(vacía)"} (${Object.keys(NEWS_CATEGORIES).join(" | ")})`);
  }
  const summary = strList(filename, "summary", data.summary);
  if (summary.length === 0) fail(filename, '"summary" necesita al menos 1 punto (idealmente 3)');
  const description = str(data.description);
  if (!description) fail(filename, 'falta "description"');

  const professions = strList(filename, "professions", data.professions);
  for (const p of professions) if (!isKnownProfession(p)) fail(filename, `profesión desconocida: ${p}`);
  const districts = strList(filename, "districts", data.districts);
  for (const d of districts) if (!isKnownDistrict(d)) fail(filename, `comunidad autónoma desconocida: ${d}`);

  const sources: NewsSource[] = [];
  if (data.sources != null) {
    if (!Array.isArray(data.sources)) fail(filename, '"sources" debe ser una lista');
    for (const item of data.sources as Array<Record<string, unknown>>) {
      const label = str(item?.label);
      const url = str(item?.url);
      if (!label || !/^https?:\/\//i.test(url)) fail(filename, '"sources" necesita {label, url http(s)}');
      sources.push({ label, url });
    }
  }

  const image = str(data.image);
  return {
    title,
    slug,
    date: isoDate(filename, "date", data.date),
    updated: data.updated ? isoDate(filename, "updated", data.updated) : undefined,
    author: str(data.author) || "Redacción VacantesSalud",
    category,
    summary,
    description,
    professions,
    districts,
    sources,
    draft: data.draft === true,
    image: image || undefined,
    body: match[2],
  };
}

/** Todos los artículos visibles (borradores solo fuera de producción), más recientes primero. */
export const listArticles = cache((): NewsArticle[] => {
  const dir = contentDir();
  if (!fs.existsSync(dir)) return [];
  const articles = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseArticle(file, fs.readFileSync(path.join(dir, file), "utf8")))
    .filter((article) => draftsAllowed() || !article.draft);
  return articles.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "es"),
  );
});

export function getArticle(slug: string): NewsArticle | null {
  return listArticles().find((article) => article.slug === slug) ?? null;
}

export function listArticlesByCategory(category: NewsCategory) {
  return listArticles().filter((article) => article.category === category);
}

/** Categorías con ≥1 artículo visible, en el orden de NEWS_CATEGORIES. */
export function listNewsCategories(): NewsCategory[] {
  const used = new Set(listArticles().map((article) => article.category));
  return (Object.keys(NEWS_CATEGORIES) as NewsCategory[]).filter((c) => used.has(c));
}

export function relatedArticles(article: NewsArticle, limit = 3) {
  return listArticles()
    .filter((other) => other.category === article.category && other.slug !== article.slug)
    .slice(0, limit);
}

/** Artículos ligados a una profesión y/o comunidad autónoma (landings de ofertas). `districts` guarda comunidades autónomas. */
export function articlesForCategory(
  profession: string | null,
  district: string | null,
  limit = 3,
) {
  return listArticles()
    .filter(
      (article) =>
        (profession != null && article.professions.includes(profession)) ||
        (district != null && article.districts.includes(district)),
    )
    .slice(0, limit);
}

export function newsTotalPages(count: number) {
  return Math.max(1, Math.ceil(count / NEWS_PAGE_SIZE));
}

export function formatNewsDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype) // sin HTML crudo: el Markdown no pasa HTML a la salida
  .use(rehypeSanitize)
  .use(rehypeExternalLinks, {
    target: "_blank",
    rel: ["noopener"],
    // solo enlaces absolutos http(s); los relativos (/empleo…) quedan internos
    test: (node) => /^https?:\/\//i.test(String(node.properties?.href ?? "")),
  })
  .use(rehypeStringify);

/** Markdown → HTML sanitizado (ejecutar en servidor, en build/ISR). */
export async function renderArticleHtml(body: string) {
  return String(await processor.process(body));
}
