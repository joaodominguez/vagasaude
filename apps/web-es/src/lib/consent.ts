"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Consentimiento de cookies (propio, sin CMP de terceros).
 * Cookie propia `vs_consent` con { v, t, analytics }.
 * Se vuelve a preguntar si cambia la versión o pasan más de 13 meses.
 */
export const CONSENT_COOKIE = "vs_consent";
export const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_DAYS = 395; // ~13 meses
const CHANGE_EVENT = "vs-consent-change";
export const OPEN_EVENT = "vs-consent-open";

/** Hay algo que consentir solo si se configuró alguna herramienta analítica. */
export const ANALYTICS_CONFIGURED = Boolean(
  (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-FDWQFVL4J1") ||
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
);

export type StoredConsent = { v: number; t: number; analytics: boolean };

function readRaw(): string {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
    return match ? match.slice(CONSENT_COOKIE.length + 1) : "";
  } catch {
    return "";
  }
}

function parse(raw: string): StoredConsent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent>;
    if (
      data.v !== CONSENT_VERSION ||
      typeof data.t !== "number" ||
      typeof data.analytics !== "boolean"
    ) {
      return null;
    }
    if (Date.now() - data.t > CONSENT_MAX_AGE_DAYS * 86_400_000) return null;
    return { v: data.v, t: data.t, analytics: data.analytics };
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean) {
  const value: StoredConsent = {
    v: CONSENT_VERSION,
    t: Date.now(),
    analytics,
  };
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
      JSON.stringify(value),
    )}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Sin almacenamiento: la elección solo vale para esta carga.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Borra cookies de analítica (GA4 y Clarity) del dominio actual y su raíz. */
export function clearAnalyticsCookies() {
  try {
    const names = document.cookie
      .split("; ")
      .map((part) => part.split("=")[0])
      .filter((name) =>
        /^(_ga(_.+)?|_gid|_gat.*|_clck|_clsk|CLID|ANONCHK|MR|MUID|SM)$/.test(name),
      );
    const host = location.hostname;
    const parts = host.split(".");
    const domains = ["", host, `.${host}`];
    if (parts.length > 2) domains.push(`.${parts.slice(-2).join(".")}`);
    else domains.push(`.${host}`);
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/${
          domain ? `; Domain=${domain}` : ""
        }`;
      }
    }
  } catch {
    // ignorar
  }
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

const SERVER_SNAPSHOT = "__server__";

/** `ready` es false hasta hidratar (evita parpadeo del banner). */
export function useConsent() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SERVER_SNAPSHOT);
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT) {
      return { ready: false, stored: null as StoredConsent | null };
    }
    return { ready: true, stored: parse(raw) };
  }, [raw]);
}
