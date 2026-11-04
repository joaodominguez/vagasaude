"use client";

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "@/lib/consent";

/**
 * ID de medición GA4 de vacantessalud.es (propiedad propia, distinta de PT).
 * Valor por defecto en código porque NEXT_PUBLIC_* se incrusta en el build; la
 * variable de entorno NEXT_PUBLIC_GA_MEASUREMENT_ID lo sobrescribe.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-FDWQFVL4J1";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function pagePath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || pathname.startsWith("/admin")) return;

    // A page view inicial é enviada pelo gtag('config') do script.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (typeof window.gtag !== "function") return;
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: pagePath(pathname, searchParams),
    });
  }, [pathname, searchParams]);

  // Cliques em links de candidatura (data-apply): evento GA4 "apply_click".
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[data-apply]");
      if (!(link instanceof HTMLAnchorElement) || typeof window.gtag !== "function") {
        return;
      }
      const data = link.dataset;
      window.gtag("event", "apply_click", {
        placement: data.apply,
        job_slug: data.jobSlug,
        company: data.jobCompany,
        profession: data.jobProfession,
        district: data.jobDistrict,
        source: data.jobSource,
        link_domain: link.hostname,
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

/**
 * Consent Mode v2: valor por defecto "denied" (script inline en <head>, ver
 * ConsentModeDefaults). gtag.js se carga siempre, pero sin consentimiento no
 * escribe ni lee cookies (pings sin cookies). Si el usuario acepta la analítica
 * en "Configurar cookies", ConsentSync envía consent "update" -> granted.
 */
export function ConsentModeDefaults() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});`,
      }}
    />
  );
}

/** Aplica la elección guardada (o hecha ahora en el panel) al Consent Mode. */
function ConsentSync({ granted }: { granted: boolean }) {
  useEffect(() => {
    if (granted && typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: "granted" });
    }
  }, [granted]);
  return null;
}

export function GoogleAnalytics() {
  const { ready, stored } = useConsent();
  if (!GA_MEASUREMENT_ID || !ready) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
      <ConsentSync granted={stored?.analytics === true} />
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker />
      </Suspense>
    </>
  );
}
