import {
  categoryPagePath,
  categoryTotalPages,
  filterJobsForCategory,
  listEligibleCategories,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { employerLastmod, listEmployers } from "@/lib/employers";
import { listEligibleConcelhos, concelhoTotalPages } from "@/lib/concelhos";
import { listConcursos, listEligibleConcursos } from "@/lib/concursos";
import { CAREERS } from "@/lib/salary-tables";
import { SITE_URL } from "@/lib/seo";
import {
  listArticles,
  listNewsCategories,
  newsCategoryPath,
  newsPagePath,
  newsPath,
  newsTotalPages,
} from "@/lib/news";

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

async function buildPagesSitemap() {
  const now = new Date();
  const entries = [
    urlEntry(`${SITE_URL}/`, now, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/vagas`, now, "daily", "0.9"),
    urlEntry(`${SITE_URL}/alertas`, now, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/como-funciona`, now, "monthly", "0.5"),
    urlEntry(`${SITE_URL}/privacidade`, now, "weekly", "0.6"),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildJobsSitemap() {
  const now = new Date();
  // getJobs() devolve só vagas publicadas (activas) — expiradas ficam fora do sitemap.
  const jobs = await getJobs();
  const entries = jobs.map((job) => {
    const published = Date.parse(job.publishedAt);
    const lastmod = Number.isNaN(published)
      ? now
      : new Date(Math.min(published, Date.now()));
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
  const now = new Date();
  const jobs = await getJobs();
  const categories = listEligibleCategories(jobs);
  const latestJob = jobs[0]?.publishedAt
    ? new Date(
        Math.min(Date.parse(jobs[0].publishedAt) || Date.now(), Date.now()),
      )
    : now;
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
          latestJob,
          "daily",
          category.kind === "combo" ? "0.7" : "0.75",
        ),
    );
  });
  // Landings de concelho (≥ CATEGORY_MIN_JOBS vagas), com /pagina-N.
  for (const item of listEligibleConcelhos(jobs)) {
    for (let page = 1; page <= concelhoTotalPages(item.count); page++) {
      entries.push(
        urlEntry(`${SITE_URL}${categoryPagePath(item.path, page)}`, latestJob, "daily", "0.65"),
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
  const now = new Date();
  const items = listConcursos(await getJobs());
  // Hub só entra com procedimentos abertos (sem eles é noindex).
  const entries =
    items.length === 0
      ? []
      : [
          urlEntry(`${SITE_URL}/concursos`, now, "daily", "0.8"),
          ...listEligibleConcursos(items).map((ref) =>
            urlEntry(`${SITE_URL}${ref.path}`, now, "daily", ref.district ? "0.6" : "0.7"),
          ),
        ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

/** Tabelas salariais: mudam com a TRU (início do ano). */
const SALARY_TABLES_UPDATED = new Date("2026-11-03T00:00:00Z");

function buildSalariesSitemap() {
  const paths = [
    "/salarios",
    "/salarios/simulador-salario-liquido",
    ...CAREERS.map((career) => `/salarios/${career.slug}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => urlEntry(`${SITE_URL}${path}`, SALARY_TABLES_UPDATED, "monthly", "0.7")).join("\n")}
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

/** Páginas de empregador (/empresas e /empresas/[slug]); lastmod = vaga mais recente. */
async function buildEmployersSitemap() {
  const employers = listEmployers(await getJobs());
  const fallback = new Date("2026-11-09T00:00:00Z");
  const lastmods = employers.map((employer) => employerLastmod(employer, fallback));
  const newest = lastmods.reduce((a, b) => (b > a ? b : a), fallback);
  const entries = [
    urlEntry(`${SITE_URL}/empresas`, newest, "daily", "0.7"),
    ...employers.map((employer, i) => urlEntry(`${SITE_URL}${employer.path}`, lastmods[i], "daily", "0.7")),
  ];
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
  if (segment === "empresas.xml") {
    return xmlResponse(await buildEmployersSitemap());
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
    return xmlResponse(buildSalariesSitemap());
  }
  if (segment === "noticias.xml") {
    return xmlResponse(buildNewsSitemap());
  }
  return new Response("Not Found", { status: 404 });
}
