/** Publisher ID AdSense — vagasaude.com.br (validação / anúncios) */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "ca-pub-8818651961085776";

/**
 * Snippet exacto pedido pelo AdSense no &lt;head&gt;.
 * Script HTML cru (não next/script) para o crawler de validação.
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
