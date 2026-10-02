import type { NextConfig } from "next";

/**
 * Cache-Control para HTML anónimo (Cloudflare).
 * - s-maxage: edge pode servir 2 min sem bater na origem
 * - stale-while-revalidate: edge serve stale enquanto revalida
 * /vagas (listagem com searchParams) fica de fora de propósito.
 * Em CF: Cache Rule "Eligible for cache" em GET HTML de / e /vagas/* se o
 * plano não cachear HTML por defeito; bypass Cookie / Authorization.
 */
const PUBLIC_HTML_CACHE =
  "public, s-maxage=120, stale-while-revalidate=600";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
      {
        source: "/vagas/:slug",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
      {
        source: "/vagas/:slug/:district",
        headers: [{ key: "Cache-Control", value: PUBLIC_HTML_CACHE }],
      },
    ];
  },
};

export default nextConfig;
