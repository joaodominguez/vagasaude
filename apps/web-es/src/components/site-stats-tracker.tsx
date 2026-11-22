"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/track-event";

/**
 * Estatísticas próprias sem cookies: nada é guardado no dispositivo.
 * Envia o caminho (sem query), UTM, referrer externo (só na 1.ª página da
 * visita) e a largura do ecrã para /api/stats via sendBeacon.
 */

function send(payload: Record<string, string | null | undefined>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/stats", body);
    } else {
      void fetch("/api/stats", { method: "POST", body, keepalive: true });
    }
  } catch {
    // Estatísticas nunca devem afetar a navegação.
  }
}

function widthBucket() {
  const w = window.innerWidth;
  if (w < 480) return "<480";
  if (w < 768) return "480-767";
  if (w < 1024) return "768-1023";
  if (w < 1440) return "1024-1439";
  return "1440+";
}

function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const first = useRef(true);

  const source = searchParams.get("utm_source");
  const medium = searchParams.get("utm_medium");
  const campaign = searchParams.get("utm_campaign");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    let referrer: string | null = null;
    if (first.current) {
      first.current = false;
      try {
        const ref = document.referrer;
        if (ref && new URL(ref).host !== window.location.host) referrer = ref;
      } catch {}
    }

    send({
      t: "pageview",
      p: pathname,
      r: referrer,
      us: source,
      um: medium,
      uc: campaign,
      w: widthBucket(),
    });
  }, [pathname, source, medium, campaign]);

  // Aterrizaje desde un email: evento email_visit (una vez por sesión y campaña).
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if ((medium ?? "").toLowerCase() !== "email") return;
    const label = (campaign ?? "").toLowerCase().replace(/[^a-z0-9_.+\- ]/g, "").slice(0, 50) || "sem_campanha";
    const key = `vs-email-visit:${label}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    trackEvent("email_visit", { campaign: label });
  }, [pathname, medium, campaign]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[data-apply]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (window.location.pathname.startsWith("/admin")) return;
      send({
        t: "event",
        e: "apply_click",
        p: window.location.pathname,
        s: link.dataset.jobSlug,
        pl: link.dataset.apply,
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

export function SiteStatsTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
