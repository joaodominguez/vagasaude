"use client";

import { openCookieSettings } from "@/lib/consent";

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Configurar cookies
    </button>
  );
}
