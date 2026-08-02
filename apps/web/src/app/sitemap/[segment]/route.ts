import { listEligibleCategories } from "@/lib/categories";
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

async function buildPagesSitemap() {
  const now = new Date();
  const entries = [
    urlEntry(`${SITE_URL}/`, now, "weekly", "1.0"),
    urlEntry(`${SITE_URL}/vagas`, now, "daily", "0.9"),
    urlEntry(`${SITE_URL}/alertas`, now, "weekly", "0.6"),
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
  const entries = categories.map((category) =>
    urlEntry(
      `${SITE_URL}${category.path}`,
      latestJob,
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
