import { SITE_URL } from "@/lib/seo";
import { hasSalaryData } from "@/lib/salary-tables";

export const dynamic = "force-dynamic";

const CHILD_SITEMAPS = [
  "pages",
  "jobs",
  "categories",
  "concorsi",
  "stipendi",
  "notizie",
  "aziende",
] as const;

export async function GET() {
  const lastmod = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CHILD_SITEMAPS.filter((id) => id !== "stipendi" || hasSalaryData()).map(
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
