import {
  categoryPagePath,
  categoryTotalPages,
  filterJobsForCategory,
  listEligibleCategories,
} from "@/lib/categories";
import { listEligibleCities } from "@/lib/cities";
import { isConcursoJob } from "@/lib/concursos";
import { listConcursos, listEligibleConcursos } from "@/lib/concursos-hub";
import type { Job } from "@/lib/jobs";
import { getJobs, getListingJobs } from "@/lib/jobs-data";
import { getSalaryObservations, listSalaryPages } from "@/lib/salary-observatory";
import {
  listArticles,
  listNewsCategories,
  newsCategoryPath,
  newsPagePath,
  newsPath,
  newsTotalPages,
} from "@/lib/news";
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
  const entries = [
    urlEntry(`${SITE_URL}/`, latestJob, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/vagas`, latestJob, "daily", "0.9"),
    urlEntry(`${SITE_URL}/alertas`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/como-funciona`, STATIC_PAGES_UPDATED, "monthly", "0.5"),
    urlEntry(`${SITE_URL}/privacidade`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
  ];
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
  // Concursos (noindex) também ficam fora.
  const jobs = (await getJobs()).filter((job) => !isConcursoJob(job));
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
  const jobs = await getListingJobs();
  const categories = listEligibleCategories(jobs);
  const fallback = newestPublished(jobs, STATIC_PAGES_UPDATED);
  const entries = categories.flatMap((category) => {
    const categoryJobs = filterJobsForCategory(
      jobs,
      category.profession,
      category.district,
    );
    // Página 1 + /pagina-N (paginação self-canonical das landings).
    return Array.from(
      { length: categoryTotalPages(categoryJobs.length) },
      (_, index) =>
        urlEntry(
      `${SITE_URL}${categoryPagePath(category.path, index + 1)}`,
          newestPublished(
            filterJobsForCategory(jobs, category.profession, category.district),
            fallback,
          ),
          "daily",
          category.kind === "combo" ? "0.7" : "0.75",
        ),
    );
  });
  // Landings de cidade (/vagas/<estado>/<cidade>), com paginação self-canonical.
  for (const city of listEligibleCities(jobs)) {
    const lastmod = newestPublished(city.jobs, fallback);
    for (let page = 1; page <= categoryTotalPages(city.jobs.length); page++) {
      entries.push(
        urlEntry(`${SITE_URL}${categoryPagePath(city.path, page)}`, lastmod, "daily", "0.6"),
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildConcursosSitemap() {
  const jobs = await getJobs();
  const items = listConcursos(jobs);
  const lastmod = newestPublished(
    items.map((item) => item.job),
    STATIC_PAGES_UPDATED,
  );
  const entries = items.length
    ? [
        urlEntry(`${SITE_URL}/concursos`, lastmod, "daily", "0.8"),
        ...listEligibleConcursos(items).map((ref) =>
          urlEntry(`${SITE_URL}${ref.path}`, lastmod, "daily", ref.district ? "0.6" : "0.7"),
        ),
      ]
    : [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildSalariesSitemap() {
  const observations = await getSalaryObservations();
  const newest = observations.reduce((latest, o) => (o.seenAt > latest ? o.seenAt : latest), "");
  const lastmod = newest ? new Date(newest) : STATIC_PAGES_UPDATED;
  const pages = await listSalaryPages();
  const entries = [
    urlEntry(`${SITE_URL}/salarios`, lastmod, "weekly", "0.7"),
    urlEntry(`${SITE_URL}/salarios/simulador-salario-liquido`, lastmod, "monthly", "0.6"),
    ...pages.map((page) =>
      urlEntry(`${SITE_URL}${page.path}`, lastmod, "weekly", page.district ? "0.6" : "0.7"),
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

function buildNewsSitemap() {
  const articles = listArticles();
  const lastmodOf = (date: string) => new Date(`${date}T00:00:00Z`);
  const entries: string[] = [];
  if (articles.length > 0) {
    const newest = lastmodOf(articles[0].updated ?? articles[0].date);
    for (let page = 1; page <= newsTotalPages(articles.length); page++) {
      entries.push(urlEntry(`${SITE_URL}${newsPagePath(page)}`, newest, "daily", page === 1 ? "0.7" : "0.4"));
    }
    for (const category of listNewsCategories()) {
      const latest = articles.find((a) => a.category === category)!;
      entries.push(
        urlEntry(`${SITE_URL}${newsCategoryPath(category)}`, lastmodOf(latest.updated ?? latest.date), "weekly", "0.5"),
      );
    }
    for (const article of articles) {
      entries.push(
        urlEntry(`${SITE_URL}${newsPath(article.slug)}`, lastmodOf(article.updated ?? article.date), "monthly", "0.6"),
      );
    }
  }
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
  if (segment === "concursos.xml") {
    return xmlResponse(await buildConcursosSitemap());
  }
  if (segment === "salarios.xml") {
    return xmlResponse(await buildSalariesSitemap());
  }
  if (segment === "noticias.xml") {
    return xmlResponse(buildNewsSitemap());
  }
  return new Response("Not Found", { status: 404 });
}
