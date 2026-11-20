import { getJobs } from "@/lib/jobs-data";
import { listOposiciones } from "@/lib/oposiciones";
import { employerLastmod, listEmployers } from "@/lib/employers";
import { listArticles } from "@/lib/news";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CHILD_SITEMAPS = [
  "pages",
  "jobs",
  "categories",
  "oposiciones",
  "salarios",
  "noticias",
  "empresas",
] as const;

/** Mismas fechas de reserva que sitemap/[segment]/route.ts. */
const STATIC_PAGES_UPDATED = new Date("2026-11-04T00:00:00Z");
const SALARY_TABLES_UPDATED = new Date("2026-11-04T00:00:00Z");

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
  // lastmod de cada sitemap = la última modificación real de su contenido (no «ahora» para todos):
  // Google/Bing solo se fían del lastmod si refleja cambios reales.
  const jobsLastmod = newest(
    jobs.map((job) => job.publishedAt),
    STATIC_PAGES_UPDATED,
  );
  const articles = listArticles();
  const employers = listEmployers(jobs);
  const lastmods: Record<(typeof CHILD_SITEMAPS)[number], Date> = {
    pages: jobsLastmod,
    jobs: jobsLastmod,
    categories: jobsLastmod,
    oposiciones: newest(
      listOposiciones(jobs).map((item) => item.job.publishedAt),
      STATIC_PAGES_UPDATED,
    ),
    salarios: SALARY_TABLES_UPDATED,
    noticias: newest(
      articles.map((a) => `${a.updated ?? a.date}T00:00:00Z`),
      STATIC_PAGES_UPDATED,
    ),
    empresas: newest(
      employers.map((employer) => employerLastmod(employer, STATIC_PAGES_UPDATED).toISOString()),
      STATIC_PAGES_UPDATED,
    ),
  };
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CHILD_SITEMAPS.map(
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
