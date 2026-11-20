import {
  categoryPagePath,
  categoryTotalPages,
  filterJobsForCategory,
  listEligibleCategories,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { employerLastmod, listEmployers } from "@/lib/employers";
import { filterConcorsi, listEligibleConcorsi, listConcorsi } from "@/lib/concorsi";
import {
  EXPIRING_LONG_DAYS,
  EXPIRING_PATH,
  HUBS,
  TYPE_MIN_INDEXABLE,
  TYPE_PAGES,
  expiringItems,
  expiringProfessionPath,
  expiringProfessions,
  itemsLastmod,
  itemsOfType,
  typePagePath,
} from "@/lib/concorsi-hubs";
import {
  listArticles,
  listNewsCategories,
  newsCategoryPath,
  newsPagePath,
  newsPath,
  newsTotalPages,
} from "@/lib/news";
import { CAREERS, hasSalaryData } from "@/lib/salary-tables";
import { buildJobsMeta, jobLastmod, listSitemapJobs } from "@/lib/sitemap-jobs";
import { RECENT_PATH } from "@/lib/recent-jobs";
import { SITE_URL } from "@/lib/seo";
import { REGIONI, ZC_HUB_PATH, hubLastmod, regionLastmod, zcRegionPath } from "@/lib/zone-carenti";

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

/** Data di riserva delle pagine fisse (ultima modifica reale dei contenuti). */
const STATIC_PAGES_UPDATED = new Date("2026-11-12T00:00:00Z");

/** Pubblicazione piu' recente (non futura) tra le offerte; senza offerte, la data di riserva. */
function newestPublished(jobs: Array<{ publishedAt: string }>, fallback: Date): Date {
  const now = Date.now();
  let best = 0;
  for (const job of jobs) {
    const t = Date.parse(job.publishedAt);
    if (!Number.isNaN(t) && t <= now && t > best) best = t;
  }
  return best ? new Date(best) : fallback;
}

async function buildPagesSitemap() {
  // lastmod = ultima pubblicazione reale (non «adesso»): Google/Bing si fidano del lastmod solo se riflette cambi veri.
  const latest = newestPublished(await getJobs(), STATIC_PAGES_UPDATED);
  const entries = [
    urlEntry(`${SITE_URL}/`, latest, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/offerte`, latest, "daily", "0.9"),
    urlEntry(`${SITE_URL}${RECENT_PATH}`, latest, "hourly", "0.9"),
    urlEntry(`${SITE_URL}/avvisi`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/come-funziona`, STATIC_PAGES_UPDATED, "monthly", "0.5"),
    urlEntry(`${SITE_URL}/dati`, latest, "daily", "0.7"),
    urlEntry(`${SITE_URL}/strumenti/calcolo-punteggio-concorso`, new Date("2026-11-20T00:00:00Z"), "monthly", "0.7"),
    urlEntry(`${SITE_URL}/privacy`, STATIC_PAGES_UPDATED, "weekly", "0.6"),
    urlEntry(`${SITE_URL}/note-legali`, STATIC_PAGES_UPDATED, "monthly", "0.3"),
    urlEntry(`${SITE_URL}/cookie`, STATIC_PAGES_UPDATED, "monthly", "0.3"),
    urlEntry(`${SITE_URL}/contatti`, STATIC_PAGES_UPDATED, "monthly", "0.3"),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function buildJobsSitemap() {
  const now = new Date();
  // Solo offerte attive, con scadenza oltre 72 h e che resteranno attive tra 72 h (lib/indexable.ts):
  // fuori dal sitemap = fuori da Indexing API e IndexNow (che lo leggono). Le scadute escono qui.
  const jobs = await listSitemapJobs();
  const entries = jobs.map((job) =>
    urlEntry(`${SITE_URL}/offerte/${job.slug}`, jobLastmod(job) ?? now, "daily", "0.8"),
  );
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
  const entries = paths.map((path) =>
    urlEntry(`${SITE_URL}${path}`, latest, "daily", path === "/concorsi" ? "0.85" : "0.75"),
  );
  // Landing aggiuntive (hub perenni, in scadenza, per tipo): lastmod = ultimo aggiornamento reale dei bandi inclusi.
  for (const hub of HUBS) {
    const hubItems = filterConcorsi(items, hub.profession, null);
    if (hubItems.length > 0) entries.push(urlEntry(`${SITE_URL}${hub.path}`, itemsLastmod(hubItems), "daily", "0.9"));
  }
  const soon = expiringItems(items, EXPIRING_LONG_DAYS);
  if (items.length > 0) {
    entries.push(urlEntry(`${SITE_URL}/concorsi/calendario`, itemsLastmod(items), "daily", "0.8"));
  }
  if (soon.length > 0) {
    entries.push(urlEntry(`${SITE_URL}${EXPIRING_PATH}`, itemsLastmod(soon), "daily", "0.85"));
    for (const [profession] of expiringProfessions(items)) {
      entries.push(
        urlEntry(
          `${SITE_URL}${expiringProfessionPath(profession)}`,
          itemsLastmod(filterConcorsi(soon, profession, null)),
          "daily",
          "0.75",
        ),
      );
    }
  }
  for (const page of TYPE_PAGES) {
    const typed = itemsOfType(items, page.type);
    if (typed.length >= TYPE_MIN_INDEXABLE) {
      entries.push(urlEntry(`${SITE_URL}${typePagePath(page.slug)}`, itemsLastmod(typed), "daily", "0.75"));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

/** Tabelle stipendi: vuote finche' non ci sono dati con fonte citata (vedi lib/salary-tables.ts). */
const SALARY_TABLES_UPDATED = new Date("2026-11-20T00:00:00Z");

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

/** Zone carenti: lastmod = data di pubblicazione ufficiale piu' recente (Regione), non la data del build. */
function buildZoneCarentiSitemap() {
  const entries = [
    urlEntry(`${SITE_URL}${ZC_HUB_PATH}`, hubLastmod(), "weekly", "0.8"),
    ...REGIONI.map((r) => urlEntry(`${SITE_URL}${zcRegionPath(r.slug)}`, regionLastmod(r), "weekly", "0.8")),
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
  if (segment === "zone-carenti.xml") {
    return xmlResponse(buildZoneCarentiSitemap());
  }
  if (segment === "jobs.xml") {
    return xmlResponse(await buildJobsSitemap());
  }
  if (segment === "jobs-meta.json") {
    // Coda della Indexing API/IndexNow (tools/indexing_notify.py): le stesse offerte del jobs.xml + metadati.
    const jobs = await listSitemapJobs();
    return new Response(
      JSON.stringify({ generatedAt: new Date().toISOString(), jobs: buildJobsMeta(jobs, SITE_URL) }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
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
