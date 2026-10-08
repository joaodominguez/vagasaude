"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Project ID Clarity — vagasaude.pt */
export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "yug1hz17w3";

export function MicrosoftClarity() {
  const pathname = usePathname();

  if (!CLARITY_PROJECT_ID || pathname?.startsWith("/admin")) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  );
}
