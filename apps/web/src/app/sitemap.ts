import type { MetadataRoute } from "next";
import {
  listEligibleCategories,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  return [{ id: "pages" }, { id: "jobs" }, { id: "categories" }];
}

export default async function sitemap(props: {
  id: Promise<string> | string;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const now = new Date();

  if (id === "pages") {
    return ["", "/vagas", "/alertas", "/privacidade"].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency:
        path === "/vagas" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : path === "/vagas" ? 0.9 : 0.6,
    }));
  }

  if (id === "categories") {
    const jobs = await getJobs();
    const categories = listEligibleCategories(jobs);
    const latestJob = jobs[0]?.publishedAt
      ? new Date(Math.min(Date.parse(jobs[0].publishedAt) || Date.now(), Date.now()))
      : now;
    return categories.map((category) => ({
      url: `${SITE_URL}${category.path}`,
      lastModified: latestJob,
      changeFrequency: "daily" as const,
      priority: category.kind === "combo" ? 0.7 : 0.75,
    }));
  }

  // jobs
  const jobs = await getJobs();
  return jobs.map((job) => {
    const published = Date.parse(job.publishedAt);
    const lastModified = Number.isNaN(published)
      ? now
      : new Date(Math.min(published, Date.now()));
    return {
      url: `${SITE_URL}/vagas/${job.slug}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    };
  });
}
