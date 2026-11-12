import {
  categoryPagePath,
  categoryTotalPages,
  filterJobsForCategory,
  listEligibleCategories,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { employerLastmod, listEmployers } from "@/lib/employers";
import { listEligibleConcorsi, listConcorsi } from "@/lib/concorsi";
import {
  listArticles,
  listNewsCategories,
  newsCategoryPath,
  newsPagePath,
  newsPath,
  newsTotalPages,
} from "@/lib/news";
import { CAREERS, hasSalaryData } from "@/lib/salary-tables";
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

async function buildPagesSitemap() {
  const now = new Date();
  const entries = [
    urlEntry(`${SITE_URL}/`, now, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/offerte`, now, "daily", "0.9"),
    urlEntry(`${SITE_URL}/avvisi`, now, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/come-funziona`, now, "monthly", "0.5"),
    urlEntry(`${SITE_URL}/dati`, now, "daily", "0.7"),
    urlEntry(`${SITE_URL}/privacy`, now, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/note-legali`, now, "monthly", "0.3"),
    urlEntry(`${SITE_URL}/cookie`, now, "monthly", "0.3"),
    urlEntry(`${SITE_URL}/contatti`, now, "monthly", "0.3"),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildJobsSitemap() {
  const now = new Date();
  // getJobs() restituisce solo offerte pubblicate (attive): quelle scadute restano fuori dalla sitemap.
  const jobs = await getJobs();
  const entries = jobs.map((job) => {
    const published = Date.parse(job.publishedAt);
    const lastmod = Number.isNaN(published)
      ? now
      : new Date(Math.min(published, Date.now()));
    return urlEntry(
      `${SITE_URL}/offerte/${job.slug}`,
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
      category.province ?? null,
    );
    // Solo la pagina 1: le /pagina-N restano accessibili e self-canonical, collegate
    // dalla paginazione, ma fuori dalla sitemap (erano oltre meta' delle voci e consumavano crawl budget).
    return Array.from(
      { length: Math.min(1, categoryTotalPages(categoryJobs.length)) },
      (_, index) =>
        urlEntry(
      `${SITE_URL}${categoryPagePath(category.path, index + 1)}`,
          latestJob,
          "daily",
          category.kind === "combo" ? "0.7" : "0.75",
        ),
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildConcorsiSitemap() {
  const now = new Date();
  const items = listConcorsi(await getJobs());
  // Hub solo con bandi; sotto-landing solo con almeno 1 (professione) / 3 (regione).
  const paths = items.length
    ? ["/concorsi", ...listEligibleConcorsi(items).map((ref) => ref.path)]
    : [];
  const latest = items[0]?.job.publishedAt
    ? new Date(Math.min(Date.parse(items[0].job.publishedAt) || Date.now(), Date.now()))
    : now;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map((path) =>
    urlEntry(`${SITE_URL}${path}`, latest, "daily", path === "/concorsi" ? "0.85" : "0.75"),
  )
  .join("\n")}
</urlset>
`;
}

/** Tabelle stipendi: vuote finche' non ci sono dati con fonte citata (vedi lib/salary-tables.ts). */
const SALARY_TABLES_UPDATED = new Date("2026-11-12T00:00:00Z");

function buildSalariesSitemap() {
  if (!hasSalaryData()) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
  }
  const paths = [
    "/stipendi",
    ...CAREERS.map((career) => `/stipendi/${career.slug}`),
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

/** Pagine azienda (/aziende e /aziende/[slug]); lastmod = offerta piu recente. */
async function buildEmployersSitemap() {
  const employers = listEmployers(await getJobs());
  const fallback = new Date("2026-11-09T00:00:00Z");
  const lastmods = employers.map((employer) => employerLastmod(employer, fallback));
  const newest = lastmods.reduce((a, b) => (b > a ? b : a), fallback);
  const entries = [
    urlEntry(`${SITE_URL}/aziende`, newest, "daily", "0.7"),
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
  if (segment === "aziende.xml") {
    return xmlResponse(await buildEmployersSitemap());
  }
  if (segment === "jobs.xml") {
    return xmlResponse(await buildJobsSitemap());
  }
  if (segment === "categories.xml") {
    return xmlResponse(await buildCategoriesSitemap());
  }
  if (segment === "concorsi.xml") {
    return xmlResponse(await buildConcorsiSitemap());
  }
  if (segment === "stipendi.xml") {
    return xmlResponse(buildSalariesSitemap());
  }
  if (segment === "notizie.xml") {
    return xmlResponse(buildNewsSitemap());
  }
  return new Response("Not Found", { status: 404 });
}
