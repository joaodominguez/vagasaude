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

/** Notizie e guide: file Markdown in content/notizie/<slug>.md (solo server). La cartella può essere vuota. */

export const NEWS_CATEGORIES = {
  "mercato-del-lavoro": {
    label: "Mercato del lavoro",
    description:
      "Report periodici e analisi del mercato del lavoro sanitario in Italia, con i dati delle offerte di Offerte Sanità.",
  },
  concorsi: {
    label: "Concorsi",
    description:
      "Sintesi di concorsi, graduatorie e avvisi pubblici per i professionisti sanitari in Italia.",
  },
  "stipendi-e-carriere": {
    label: "Stipendi e carriere",
    description:
      "Notizie su stipendi, contratti collettivi, carriera e condizioni dei professionisti sanitari.",
  },
  guide: {
    label: "Guide",
    description:
      "Guide pratiche per i professionisti sanitari: curriculum, candidature, bandi e lavoro in Italia.",
  },
} as const;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_PAGE_SIZE = 20;
/** Segmenti di /notizie/* che non si possono usare come slug. */
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
  /** Markdown grezzo (senza frontmatter). */
  body: string;
};

export function isNewsCategory(value: string): value is NewsCategory {
  return Object.prototype.hasOwnProperty.call(NEWS_CATEGORIES, value);
}

export function newsCategoryLabel(category: NewsCategory) {
  return NEWS_CATEGORIES[category].label;
}

export const newsPath = (slug: string) => `/notizie/${slug}`;
export const newsCategoryPath = (category: NewsCategory) =>
  `/notizie/categoria/${category}`;
export const newsPagePath = (page: number) =>
  page <= 1 ? "/notizie" : `/notizie/pagina/${page}`;

function contentDir() {
  return path.join(process.cwd(), "content", "notizie");
}

/** Le bozze non esistono mai in produzione (né in build né a runtime). */
function draftsAllowed() {
  return process.env.NODE_ENV !== "production";
}

function fail(file: string, message: string): never {
  throw new Error(`[notizie] ${file}: ${message}`);
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strList(file: string, field: string, value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(file, `"${field}" deve essere una lista`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isoDate(file: string, field: string, value: unknown): string {
  // YAML può restituire una Date: normalizza in AAAA-MM-GG.
  const text =
    value instanceof Date ? value.toISOString().slice(0, 10) : str(value);
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
    fail(file, `"${field}" deve essere una data ISO (AAAA-MM-GG)`);
  }
  return text;
}

function parseArticle(filename: string, raw: string): NewsArticle {
  const match = raw.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) fail(filename, "manca il frontmatter YAML (---)");
  let data: Record<string, unknown>;
  try {
    data = (parseYaml(match[1], { schema: "core" }) ?? {}) as Record<string, unknown>;
  } catch (error) {
    return fail(filename, `YAML non valido (${(error as Error).message})`);
  }

  const expectedSlug = filename.replace(/\.md$/, "");
  const slug = str(data.slug);
  if (slug !== expectedSlug) fail(filename, `"slug" deve coincidere con il nome del file (${expectedSlug})`);
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) fail(filename, `slug non valido o riservato: ${slug}`);

  const title = str(data.title);
  if (!title) fail(filename, 'manca "title"');
  const category = str(data.category);
  if (!isNewsCategory(category)) {
    fail(filename, `"category" non valida: ${category || "(vuota)"} (${Object.keys(NEWS_CATEGORIES).join(" | ")})`);
  }
  const summary = strList(filename, "summary", data.summary);
  if (summary.length === 0) fail(filename, '"summary" richiede almeno 1 punto (idealmente 3)');
  const description = str(data.description);
  if (!description) fail(filename, 'manca "description"');

  const professions = strList(filename, "professions", data.professions);
  for (const p of professions) if (!isKnownProfession(p)) fail(filename, `professione sconosciuta: ${p}`);
  const districts = strList(filename, "districts", data.districts);
  for (const d of districts) if (!isKnownDistrict(d)) fail(filename, `regione sconosciuta: ${d}`);

  const sources: NewsSource[] = [];
  if (data.sources != null) {
    if (!Array.isArray(data.sources)) fail(filename, '"sources" debe ser una lista');
    for (const item of data.sources as Array<Record<string, unknown>>) {
      const label = str(item?.label);
      const url = str(item?.url);
      if (!label || !/^https?:\/\//i.test(url)) fail(filename, '"sources" richiede {label, url http(s)}');
      sources.push({ label, url });
    }
  }

  const image = str(data.image);
  return {
    title,
    slug,
    date: isoDate(filename, "date", data.date),
    updated: data.updated ? isoDate(filename, "updated", data.updated) : undefined,
    author: str(data.author) || "Redazione Offerte Sanità",
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

/** Tutti gli articoli visibili (bozze solo fuori produzione), dai più recenti. */
export const listArticles = cache((): NewsArticle[] => {
  const dir = contentDir();
  if (!fs.existsSync(dir)) return [];
  const articles = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseArticle(file, fs.readFileSync(path.join(dir, file), "utf8")))
    .filter((article) => draftsAllowed() || !article.draft);
  return articles.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "it"),
  );
});

export function getArticle(slug: string): NewsArticle | null {
  return listArticles().find((article) => article.slug === slug) ?? null;
}

export function listArticlesByCategory(category: NewsCategory) {
  return listArticles().filter((article) => article.category === category);
}

/** Categorie con almeno 1 articolo visibile, nell'ordine di NEWS_CATEGORIES. */
export function listNewsCategories(): NewsCategory[] {
  const used = new Set(listArticles().map((article) => article.category));
  return (Object.keys(NEWS_CATEGORIES) as NewsCategory[]).filter((c) => used.has(c));
}

export function relatedArticles(article: NewsArticle, limit = 3) {
  return listArticles()
    .filter((other) => other.category === article.category && other.slug !== article.slug)
    .slice(0, limit);
}

/** Articoli legati a una professione e/o a una regione (landing delle offerte). `districts` contiene le regioni. */
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
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype) // niente HTML grezzo: il Markdown non passa HTML in uscita
  .use(rehypeSanitize)
  .use(rehypeExternalLinks, {
    target: "_blank",
    rel: ["noopener"],
    // solo link assoluti http(s); quelli relativi (/offerte…) restano interni
    test: (node) => /^https?:\/\//i.test(String(node.properties?.href ?? "")),
  })
  .use(rehypeStringify);

/** Markdown -> HTML sanificato (da eseguire sul server, in build/ISR). */
export async function renderArticleHtml(body: string) {
  return String(await processor.process(body));
}

/** true se esiste almeno un articolo visibile (per mostrare/nascondere i link alle notizie). */
export function hasArticles() {
  return listArticles().length > 0;
}
