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

/** Notícias: arquivos Markdown em content/noticias/<slug>.md (só servidor). */

export const NEWS_CATEGORIES = {
  "mercado-de-trabalho": {
    label: "Mercado de trabalho",
    description:
      "Relatórios e análises do mercado de emprego em saúde no Brasil, com dados das vagas do VagaSaúde.",
  },
  concursos: {
    label: "Concursos",
    description:
      "Concursos públicos e processos seletivos para profissionais de saúde no Brasil.",
  },
  "salarios-e-carreiras": {
    label: "Salários e carreiras",
    description:
      "Notícias sobre salários, pisos, progressão e carreiras dos profissionais de saúde.",
  },
  guias: {
    label: "Guias",
    description:
      "Guias práticos para profissionais de saúde: currículo, candidatura, editais e alertas para emprego em saúde no Brasil.",
  },
} as const;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_PAGE_SIZE = 20;
/** Segmentos de /noticias/* que não podem ser usados como slug. */
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
  /** Markdown cru (sem frontmatter). */
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

/** Rascunhos nunca existem em produção (build ou runtime). */
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
  if (!Array.isArray(value)) fail(file, `"${field}" precisa ser uma lista`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isoDate(file: string, field: string, value: unknown): string {
  // O YAML pode devolver Date; normalizar para YYYY-MM-DD.
  const text =
    value instanceof Date ? value.toISOString().slice(0, 10) : str(value);
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
    fail(file, `"${field}" precisa ser uma data ISO (AAAA-MM-DD)`);
  }
  return text;
}

function parseArticle(filename: string, raw: string): NewsArticle {
  const match = raw.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) fail(filename, "frontmatter YAML ausente (---)");
  let data: Record<string, unknown>;
  try {
    data = (parseYaml(match[1], { schema: "core" }) ?? {}) as Record<string, unknown>;
  } catch (error) {
    return fail(filename, `YAML inválido (${(error as Error).message})`);
  }

  const expectedSlug = filename.replace(/\.md$/, "");
  const slug = str(data.slug);
  if (slug !== expectedSlug) fail(filename, `"slug" precisa ser igual ao nome do ficheiro (${expectedSlug})`);
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) fail(filename, `slug inválido ou reservado: ${slug}`);

  const title = str(data.title);
  if (!title) fail(filename, '"title" ausente');
  const category = str(data.category);
  if (!isNewsCategory(category)) {
    fail(filename, `"category" inválida: ${category || "(vazia)"} (${Object.keys(NEWS_CATEGORIES).join(" | ")})`);
  }
  const summary = strList(filename, "summary", data.summary);
  if (summary.length === 0) fail(filename, '"summary" precisa de ao menos 1 ponto (idealmente 3)');
  const description = str(data.description);
  if (!description) fail(filename, '"description" ausente');

  const professions = strList(filename, "professions", data.professions);
  for (const p of professions) if (!isKnownProfession(p)) fail(filename, `profissão desconhecida: ${p}`);
  const districts = strList(filename, "districts", data.districts);
  for (const d of districts) if (!isKnownDistrict(d)) fail(filename, `estado desconhecido: ${d}`);

  const sources: NewsSource[] = [];
  if (data.sources != null) {
    if (!Array.isArray(data.sources)) fail(filename, '"sources" precisa ser uma lista');
    for (const item of data.sources as Array<Record<string, unknown>>) {
      const label = str(item?.label);
      const url = str(item?.url);
      if (!label || !/^https?:\/\//i.test(url)) fail(filename, '"sources" precisa de {label, url http(s)}');
      sources.push({ label, url });
    }
  }

  const image = str(data.image);
  return {
    title,
    slug,
    date: isoDate(filename, "date", data.date),
    updated: data.updated ? isoDate(filename, "updated", data.updated) : undefined,
    author: str(data.author) || "Redação VagaSaúde",
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

/** Todos os artigos visíveis (rascunhos só fora de produção), mais recentes primeiro. */
export const listArticles = cache((): NewsArticle[] => {
  const dir = contentDir();
  if (!fs.existsSync(dir)) return [];
  const articles = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseArticle(file, fs.readFileSync(path.join(dir, file), "utf8")))
    .filter((article) => draftsAllowed() || !article.draft);
  return articles.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "pt-BR"),
  );
});

export function getArticle(slug: string): NewsArticle | null {
  return listArticles().find((article) => article.slug === slug) ?? null;
}

export function listArticlesByCategory(category: NewsCategory) {
  return listArticles().filter((article) => article.category === category);
}

/** Categorias com ≥1 artigo visível, na ordem de NEWS_CATEGORIES. */
export function listNewsCategories(): NewsCategory[] {
  const used = new Set(listArticles().map((article) => article.category));
  return (Object.keys(NEWS_CATEGORIES) as NewsCategory[]).filter((c) => used.has(c));
}

export function relatedArticles(article: NewsArticle, limit = 3) {
  return listArticles()
    .filter((other) => other.category === article.category && other.slug !== article.slug)
    .slice(0, limit);
}

/** Artigos ligados a uma profissão e/ou distrito (landings de vagas). */
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
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype) // sem HTML cru: o Markdown não passa HTML para a saída
  .use(rehypeSanitize)
  .use(rehypeExternalLinks, {
    target: "_blank",
    rel: ["noopener"],
    // só links absolutos http(s); relativos (/vagas…) ficam internos
    test: (node) => /^https?:\/\//i.test(String(node.properties?.href ?? "")),
  })
  .use(rehypeStringify);

/** Markdown → HTML sanitizado (correr no servidor, em build/ISR). */
export async function renderArticleHtml(body: string) {
  return String(await processor.process(body));
}
