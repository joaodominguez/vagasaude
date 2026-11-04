"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ANALYTICS_CONFIGURED,
  OPEN_EVENT,
  clearAnalyticsCookies,
  saveConsent,
  useConsent,
} from "@/lib/consent";

export function CookieConsent() {
  const { ready, stored } = useConsent();
  const [reopened, setReopened] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const analyticsChoice = choice ?? stored?.analytics ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const mustAsk = ready && ANALYTICS_CONFIGURED && !stored;
  const visible = mustAsk || reopened;

  useEffect(() => {
    function onOpen() {
      previousFocus.current = document.activeElement as HTMLElement | null;
      setChoice(null);
      setConfiguring(true);
      setReopened(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (reopened) dialogRef.current?.focus();
  }, [reopened]);

  function close() {
    setReopened(false);
    setConfiguring(false);
    setChoice(null);
    previousFocus.current?.focus?.();
  }

  function decide(analytics: boolean) {
    const wasGranted = stored?.analytics === true;
    saveConsent(analytics);
    if (wasGranted && !analytics) {
      // Retirada: borrar cookies y recargar para detener los scripts ya cargados.
      clearAnalyticsCookies();
      window.location.reload();
      return;
    }
    close();
  }

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && stored) close();
      }}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface-raised p-5 shadow-[var(--shadow)]">
        <h2 id="cookie-title" className="text-base font-extrabold">
          Tu privacidad
        </h2>
        <p id="cookie-desc" className="mt-2 text-sm leading-6 text-muted">
          {ANALYTICS_CONFIGURED
            ? "Usamos cookies técnicas necesarias y, solo si lo aceptas, cookies analíticas (Google Analytics y Microsoft Clarity) para mejorar el servicio. Puedes aceptar, rechazar o configurar. "
            : "Ahora mismo solo usamos almacenamiento técnico necesario; no hay cookies opcionales activas. "}
          Más información en la{" "}
          <Link className="font-bold text-primary underline" href="/cookies">
            política de cookies
          </Link>
          .
        </p>

        {configuring ? (
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <p className="font-bold">Técnicas necesarias</p>
                <p className="mt-1 text-muted">
                  Guardan tu elección de cookies, tu tema y tus favoritos. No
                  se pueden desactivar.
                </p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Cookies técnicas necesarias (siempre activas)"
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
            </div>
            <label
              htmlFor="cookie-analytics"
              className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-3"
            >
              <span>
                <span className="block font-bold">Analíticas</span>
                <span className="mt-1 block text-muted">
                  Google Analytics y Microsoft Clarity: medición de visitas y
                  grabación anonimizada de interacciones.
                </span>
              </span>
              <input
                id="cookie-analytics"
                type="checkbox"
                checked={analyticsChoice}
                onChange={(event) => setChoice(event.target.checked)}
                disabled={!ANALYTICS_CONFIGURED}
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="button button-primary"
            onClick={() => decide(true)}
          >
            Aceptar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => decide(false)}
          >
            Rechazar
          </button>
          {configuring ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => decide(analyticsChoice)}
            >
              Guardar selección
            </button>
          ) : (
            <button
              type="button"
              className="button button-secondary"
              aria-expanded={false}
              onClick={() => {
                setChoice(null);
                setConfiguring(true);
              }}
            >
              Configurar
            </button>
          )}
          {reopened && stored ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={close}
            >
              Cerrar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
