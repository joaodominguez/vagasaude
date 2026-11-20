import { listConcursos } from "@/lib/concursos-hub";
import { getJobs } from "@/lib/jobs-data";
import { listArticles } from "@/lib/news";
import { getSalaryObservations } from "@/lib/salary-observatory";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CHILD_SITEMAPS = [
  "pages",
  "jobs",
  "categories",
  "landings",
  "concursos",
  "salarios",
  "noticias",
  "empresas",
] as const;

/** Mesma data de reserva das páginas estáticas (sitemap/[segment]/route.ts). */
const STATIC_PAGES_UPDATED = new Date("2026-10-01T00:00:00Z");

function newest(dates: Array<string | null | undefined>, fallback: Date): Date {
  const now = Date.now();
  let best = 0;
  for (const value of dates) {
    const t = value ? Date.parse(value) : NaN;
    if (!Number.isNaN(t) && t <= now && t > best) best = t;
  }
  return best ? new Date(best) : fallback;
}

export async function GET() {
  const jobs = await getJobs();
  // lastmod de cada sitemap = a última alteração real do seu conteúdo (não a mesma data para todos,
  // nem "agora"): o Bing/Google só confiam no lastmod se refletir mudanças reais.
  const jobsLastmod = newest(jobs.map((job) => job.publishedAt), STATIC_PAGES_UPDATED);
  const articles = listArticles();
  const lastmods: Record<(typeof CHILD_SITEMAPS)[number], Date> = {
    pages: jobsLastmod,
    jobs: jobsLastmod,
    categories: jobsLastmod,
    landings: jobsLastmod,
    empresas: jobsLastmod,
    concursos: newest(
      listConcursos(jobs).map((item) => item.job.publishedAt),
      STATIC_PAGES_UPDATED,
    ),
    salarios: newest(
      (await getSalaryObservations()).map((o) => o.seenAt),
      STATIC_PAGES_UPDATED,
    ),
    noticias: newest(
      articles.map((a) => `${a.updated ?? a.date}T00:00:00Z`),
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
