import { getJobs } from "@/lib/jobs-data";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CHILD_SITEMAPS = [
  "pages",
  "jobs",
  "categories",
] as const;

export async function GET() {
  const now = Date.now();
  let newest = 0;
  for (const job of await getJobs()) {
    const t = Date.parse(job.publishedAt);
    if (!Number.isNaN(t) && t <= now && t > newest) newest = t;
  }
  const lastmod = new Date(newest || now).toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CHILD_SITEMAPS.map(
  (id) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
).join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
