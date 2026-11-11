import type { NextConfig } from "next";

/**
 * Cache-Control para HTML anónimo (Cloudflare).
 * - s-maxage: edge pode servir 10 min sem bater na origem (= revalidate das páginas;
 *   a origem só regenera de 10 em 10 min, por isso 2 min só repetia a mesma página)
 * - stale-while-revalidate: edge serve stale enquanto revalida
 * /vagas (listagem com searchParams) fica de fora de propósito.
 * Em CF: Cache Rule "Eligible for cache" em GET HTML de / e /vagas/* se o
 * plano não cachear HTML por defeito; bypass Cookie / Authorization.
 */
const PUBLIC_HTML_CACHE =
  "public, s-maxage=600, stale-while-revalidate=600";

const nextConfig: NextConfig = {
  output: "standalone",
  // Artigos de notícias são lidos do disco em runtime (ISR): incluir no bundle standalone.
  outputFileTracingIncludes: {
    "/*": ["./content/noticias/**/*"],
  },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/artigos", destination: "/noticias/categoria/guias", permanent: true },
      { source: "/artigos/:slug", destination: "/noticias/:slug", permanent: true },
    ];
  },
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
