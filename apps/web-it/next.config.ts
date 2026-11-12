import type { NextConfig } from "next";

/**
 * Cache-Control per HTML anonimo (Cloudflare).
 * - s-maxage: l edge puo servire 2 min senza interrogare l origine
 * - stale-while-revalidate: l edge serve stale mentre rivalida
 * /offerte (elenco con searchParams) resta fuori di proposito.
 * In CF: Cache Rule "Eligible for cache" em GET HTML di / e /offerte/* se il
 * piano non cacheizza l'HTML di default; bypass Cookie / Authorization.
 * Vedi docs/ (Cloudflare Cache Rules): da fare solo dopo approvazione.
 */
const PUBLIC_HTML_CACHE =
  "public, s-maxage=120, stale-while-revalidate=600";

const nextConfig: NextConfig = {
  output: "standalone",
  // Gli articoli (notizie/guide) si leggono dal disco in runtime (ISR): includerli nel bundle standalone.
  outputFileTracingIncludes: {
    "/*": ["./content/notizie/**/*"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
      {
        source: "/offerte/:slug",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
      {
        source: "/offerte/:slug/:district",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
    ];
  },
};

export default nextConfig;
