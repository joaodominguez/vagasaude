"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Consenso ai cookie (gestione propria, senza CMP di terze parti).
 * Cookie tecnico proprio `os_consent` con { v, t, analytics }.
 * Il consenso viene richiesto di nuovo se cambia la versione o dopo 13 mesi
 * (le Linee guida del Garante del 10 giugno 2021 indicano almeno 6 mesi per
 * chi ha rifiutato; qui si usa un'unica durata prudente e semplice).
 */
export const CONSENT_COOKIE = "os_consent";
export const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_DAYS = 395; // ~13 mesi
const CHANGE_EVENT = "os-consent-change";
export const OPEN_EVENT = "os-consent-open";

/**
 * C'è qualcosa da consentire solo se è configurato almeno uno strumento di
 * analytics (nessun ID predefinito: senza variabili d'ambiente non si carica nulla).
 */
export const ANALYTICS_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
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
    // Nessun archivio disponibile: la scelta vale solo per questo caricamento.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Elimina i cookie di analytics (GA4 e Clarity) dal dominio corrente e dal dominio radice. */
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
    // ignora
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

/** `ready` è false fino all'idratazione (evita lo sfarfallio del banner). */
export function useConsent() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SERVER_SNAPSHOT);
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT) {
      return { ready: false, stored: null as StoredConsent | null };
    }
    return { ready: true, stored: parse(raw) };
  }, [raw]);
}
