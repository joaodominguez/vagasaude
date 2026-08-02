import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/jobs-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vagasaude.pt";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await getJobs();
  const staticPages = ["", "/vagas", "/alertas", "/privacidade"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency:
        path === "/vagas" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : 0.8,
    }),
  );

  return [
    ...staticPages,
    ...jobs.map((job) => ({
      url: `${siteUrl}/vagas/${job.slug}`,
      lastModified: new Date(job.publishedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
