"use client";

/**
 * Eventos de medição: GA4 (respeita o consentimento já configurado no gtag)
 * + contador interno sem cookies (/api/stats, só contagens por dia).
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

/** Termo de pesquisa sem dados pessoais (emails, números longos). */
export function safeSearchTerm(raw: string): string | null {
  const term = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
  if (!term || term.includes("@") || /\d[\d\s().+-]{5,}\d/.test(term)) return null;
  return term;
}

export function trackEvent(name: TrackEventName, params: Params = {}) {
  try {
    if (window.location.pathname.startsWith("/admin")) return;
    if (typeof window.gtag === "function") window.gtag("event", name, params);
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
