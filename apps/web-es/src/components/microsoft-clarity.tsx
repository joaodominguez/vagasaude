import Script from "next/script";

/**
 * Project ID de Clarity. SIN valor por defecto a propósito: el de vagasaude.pt
 * no debe reutilizarse. Crear un proyecto Clarity para vacantessalud.es y
 * definir NEXT_PUBLIC_CLARITY_PROJECT_ID.
 */
export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";

/**
 * Microsoft Clarity (heatmaps / sesiones).
 * Server component + Script afterInteractive — el snippet queda en el HTML
 * como GA4, para que la etiqueta cargue sin depender de la hidratación.
 */
export function MicrosoftClarity() {
  if (!CLARITY_PROJECT_ID) return null;

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
