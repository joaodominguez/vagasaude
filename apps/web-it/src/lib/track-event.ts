"use client";

/**
 * Eventi di misurazione: GA4/GTM (attivo salvo rifiuto registrato nel
 * cookie os_consent, via dataLayer come gli altri eventi) +
 * contatore interno senza cookie (/api/stats, solo conteggi per giorno).
 */

export type TrackEventName =
  | "alert_signup"
  | "alert_confirm"
  | "email_visit"
  | "favorite_add"
  | "search"
  | "share";

type Params = Record<string, string | number | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Termine di ricerca senza dati personali (email, numeri lunghi). */
export function safeSearchTerm(raw: string): string | null {
  const term = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
  if (!term || term.includes("@") || /\d[\d\s().+-]{5,}\d/.test(term)) return null;
  return term;
}

/** Sola lettura della scelta salvata (cookie os_consent): attivo salvo rifiuto esplicito. */
function analyticsGranted(): boolean {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return false;
  try {
    const match = document.cookie.split("; ").find((p) => p.startsWith("os_consent="));
    if (!match) return true;
    const data = JSON.parse(decodeURIComponent(match.slice("os_consent=".length)));
    return data?.analytics !== false;
  } catch {
    return false;
  }
}

export function trackEvent(name: TrackEventName, params: Params = {}) {
  try {
    if (window.location.pathname.startsWith("/admin")) return;
    if (analyticsGranted()) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
    }
  } catch {}
  try {
    const campaign = typeof params.campaign === "string" ? params.campaign : undefined;
    const body = JSON.stringify({
      t: "event",
      e: name,
      p: window.location.pathname,
      c: campaign,
    });
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/stats", body);
    } else {
      void fetch("/api/stats", { method: "POST", body, keepalive: true });
    }
  } catch {}
}
