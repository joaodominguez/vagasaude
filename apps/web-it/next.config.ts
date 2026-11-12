import type { NextConfig } from "next";

/**
 * Cache-Control per HTML anonimo (Cloudflare).
 * - s-maxage: l edge puo servire 10 min senza interrogare l origine (come PT/BR, 2026-11-12)
 * - stale-while-revalidate: l edge serve stale mentre rivalida
 * /offerte (elenco con searchParams) resta fuori di proposito.
 * In CF (zona offertesanita.it, 2026-11-12): Cache Rule su /, /offerte/*, /aziende, /aziende/*,
 * /dati, che rispetta questo s-maxage ed esclude le richieste RSC senza _rsc.
 */
const PUBLIC_HTML_CACHE =
  "public, s-maxage=600, stale-while-revalidate=600";

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
