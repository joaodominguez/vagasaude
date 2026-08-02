import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap/pages.xml`,
      `${SITE_URL}/sitemap/jobs.xml`,
      `${SITE_URL}/sitemap/categories.xml`,
    ],
    host: SITE_URL,
  };
}
