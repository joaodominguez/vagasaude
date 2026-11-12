"use client";

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "@/lib/consent";

/**
 * ID di misurazione GA4 di offertesanita.it. NESSUN valore predefinito: se
 * NEXT_PUBLIC_GA_MEASUREMENT_ID non è impostata, GA4 non viene caricato.
 * (NEXT_PUBLIC_* viene incorporata nel build.)
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

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

    // La prima visualizzazione di pagina è inviata dal gtag('config') dello script.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (typeof window.gtag !== "function") return;
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: pagePath(pathname, searchParams),
    });
  }, [pathname, searchParams]);

  // Clic sui link di candidatura (data-apply): evento GA4 "apply_click".
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
 * Consent Mode: tutto negato per impostazione predefinita (opt-in). GA4 viene
 * caricato solo dopo che il visitante ha accettato gli analytics nel banner;
 * pubblicità e personalizzazione restano sempre negate.
 */
export function ConsentModeDefaults() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});`,
      }}
    />
  );
}

export function GoogleAnalytics() {
  const { ready, stored } = useConsent();
  // Si misura solo dopo il consenso esplicito.
  if (!GA_MEASUREMENT_ID || !ready || !stored?.analytics) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'update', { analytics_storage: 'granted' });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker />
      </Suspense>
    </>
  );
}
