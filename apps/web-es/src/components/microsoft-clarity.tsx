"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";

/**
 * Project ID de Clarity. SIN valor por defecto a propósito: el de vagasaude.pt
 * no debe reutilizarse. Crear un proyecto Clarity para vacantessalud.es y
 * definir NEXT_PUBLIC_CLARITY_PROJECT_ID.
 */
export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";

/**
 * Microsoft Clarity (heatmaps / sesiones).
 * NO se carga en absoluto hasta que el usuario acepta la analítica.
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
