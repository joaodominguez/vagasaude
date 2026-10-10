/** Publisher ID AdSense — vagasaude.pt (validação / anúncios) */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "ca-pub-8818651961085776";

/**
 * Snippet exacto pedido pelo AdSense no &lt;head&gt;.
 * Não usar next/script: o crawler de validação procura
 * &lt;script async src="…adsbygoogle.js?client=ca-pub-…"&gt;.
 */
export function GoogleAdSense() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
