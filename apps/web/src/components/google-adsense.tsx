import Script from "next/script";

/** Publisher ID AdSense — vagasaude.pt (validação / anúncios) */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "ca-pub-8818651961085776";

/**
 * Script AdSense no &lt;head&gt; (pedido de validação da propriedade).
 * strategy beforeInteractive injeta no head do documento.
 */
export function GoogleAdSense() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  );
}
