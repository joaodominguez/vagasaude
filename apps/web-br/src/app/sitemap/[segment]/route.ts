import {
  filterJobsForCategory,
  listEligibleCategories,
} from "@/lib/categories";
import type { Job } from "@/lib/jobs";
import { getJobs } from "@/lib/jobs-data";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(
  loc: string,
  lastmod: Date,
  changefreq: string,
  priority: string,
) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod.toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Última alteração de conteúdo das páginas estáticas; actualizar quando mudarem. */
const STATIC_PAGES_UPDATED = new Date("2026-10-01T00:00:00Z");

/** lastmod tem de reflectir mudanças reais; "agora" em cada pedido faz o Google ignorá-lo. */
function newestPublished(jobs: Job[], fallback: Date) {
  const now = Date.now();
  let newest = 0;
  for (const job of jobs) {
    const t = Date.parse(job.publishedAt);
    if (!Number.isNaN(t) && t <= now && t > newest) newest = t;
  }
  return newest ? new Date(newest) : fallback;
}

async function buildPagesSitemap() {
  const latestJob = newestPublished(await getJobs(), STATIC_PAGES_UPDATED);
  const { articles } = await import("@/content/articles");
  const articleDates = articles
    .map((article) => Date.parse(article.publishedAt))
    .filter((t) => !Number.isNaN(t));
  const latestArticle = articleDates.length
    ? new Date(Math.max(...articleDates))
    : STATIC_PAGES_UPDATED;
  const entries = [
    urlEntry(`${SITE_URL}/`, latestJob, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/vagas`, latestJob, "daily", "0.9"),
    urlEntry(`${SITE_URL}/alertas`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/artigos`, latestArticle, "weekly", "0.7"),
    urlEntry(`${SITE_URL}/como-funciona`, STATIC_PAGES_UPDATED, "monthly", "0.5"),
    urlEntry(`${SITE_URL}/privacidade`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
  ];
  for (const article of articles) {
    const published = Date.parse(article.publishedAt);
    const lastmod = Number.isNaN(published)
      ? STATIC_PAGES_UPDATED
      : new Date(published);
    entries.push(
      urlEntry(
        `${SITE_URL}/artigos/${article.slug}`,
        lastmod,
        "monthly",
        "0.65",
      ),
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildJobsSitemap() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // getJobs() devolve só vagas publicadas (ativas) — expiradas ficam fora do sitemap.
  const jobs = await getJobs();
  const entries = jobs.map((job) => {
    const published = Date.parse(job.publishedAt);
    const lastmod =
      Number.isNaN(published) || published > Date.now()
        ? today
        : new Date(published);
    return urlEntry(
      `${SITE_URL}/vagas/${job.slug}`,
      lastmod,
      "daily",
      "0.8",
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildCategoriesSitemap() {
  const jobs = await getJobs();
  const categories = listEligibleCategories(jobs);
  const fallback = newestPublished(jobs, STATIC_PAGES_UPDATED);
  const entries = categories.map((category) =>
    urlEntry(
      `${SITE_URL}${category.path}`,
      newestPublished(
        filterJobsForCategory(jobs, category.profession, category.district),
        fallback,
      ),
      "daily",
      category.kind === "combo" ? "0.7" : "0.75",
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ segment: string }> },
) {
  const { segment } = await context.params;
  if (segment === "pages.xml") {
    return xmlResponse(await buildPagesSitemap());
  }
  if (segment === "jobs.xml") {
    return xmlResponse(await buildJobsSitemap());
  }
  if (segment === "categories.xml") {
    return xmlResponse(await buildCategoriesSitemap());
  }
  return new Response("Not Found", { status: 404 });
}
