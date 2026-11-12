"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";

/**
 * Project ID di Clarity. SENZA valore predefinito a proposito: va creato un
 * progetto Clarity dedicato a offertesanita.it e impostato
 * NEXT_PUBLIC_CLARITY_PROJECT_ID. Se vuoto, Clarity non viene caricato.
 */
export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";

/**
 * Microsoft Clarity (heatmap / sessioni).
 * NON viene caricato finché l'utente non accetta gli analytics.
 */
export function MicrosoftClarity() {
  const { ready, stored } = useConsent();
  if (!CLARITY_PROJECT_ID || !ready || !stored?.analytics) return null;

  return (
    <Script id="microsoft-clarity" strategy="lazyOnload">
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
