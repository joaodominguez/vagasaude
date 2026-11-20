import { SITE_URL } from "@/lib/seo";
import { hasSalaryData } from "@/lib/salary-tables";
import { getJobs } from "@/lib/jobs-data";
import { listArticles } from "@/lib/news";
import { employerLastmod, listEmployers } from "@/lib/employers";
import { listConcorsi } from "@/lib/concorsi";

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

/** Stesse date di riserva di sitemap/[segment]/route.ts. */
const STATIC_PAGES_UPDATED = new Date("2026-11-12T00:00:00Z");
const SALARY_TABLES_UPDATED = new Date("2026-11-18T00:00:00Z");

function newest(dates: Array<string | null | undefined>, fallback: Date): Date {
  const now = Date.now();
  let best = 0;
  for (const value of dates) {
    const t = value ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(t) && t <= now && t > best) best = t;
  }
  return best ? new Date(best) : fallback;
}

export async function GET() {
  const jobs = await getJobs();
  // lastmod di ogni sitemap = ultima modifica reale del suo contenuto (non «adesso» per tutti).
  const jobsLastmod = newest(jobs.map((job) => job.publishedAt), STATIC_PAGES_UPDATED);
  const articles = listArticles();
  const employers = listEmployers(jobs);
  const lastmods: Record<(typeof CHILD_SITEMAPS)[number], Date> = {
    pages: jobsLastmod,
    jobs: jobsLastmod,
    categories: jobsLastmod,
    concorsi: newest(listConcorsi(jobs).map((item) => item.job.publishedAt), STATIC_PAGES_UPDATED),
    stipendi: SALARY_TABLES_UPDATED,
    notizie: newest(articles.map((a) => `${a.updated ?? a.date}T00:00:00Z`), STATIC_PAGES_UPDATED),
    aziende: newest(
      employers.map((employer) => employerLastmod(employer, STATIC_PAGES_UPDATED).toISOString()),
      STATIC_PAGES_UPDATED,
    ),
  };
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CHILD_SITEMAPS.filter((id) => id !== "stipendi" || hasSalaryData()).map(
  (id) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lastmods[id].toISOString()}</lastmod>
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
