import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/jobs-data";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await getJobs();
  const staticPages = ["", "/vagas", "/alertas", "/privacidade"].map(
    (path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency:
        path === "/vagas" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : path === "/vagas" ? 0.9 : 0.6,
    }),
  );

  return [
    ...staticPages,
    ...jobs.map((job) => ({
      url: `${SITE_URL}/vagas/${job.slug}`,
      lastModified: new Date(job.publishedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
