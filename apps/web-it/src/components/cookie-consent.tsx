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
  // Opt-in: gli analytics sono disattivati finché l'utente non li accetta.
  const analyticsChoice = choice ?? stored?.analytics ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Il banner compare da solo solo se sono configurati strumenti di analytics e
  // non c'è ancora una scelta salvata; altrimenti si apre da "Impostazioni cookie".
  const visible = reopened || (ANALYTICS_CONFIGURED && ready && !stored);

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
      // Revoca: elimina i cookie e ricarica per fermare gli script già caricati.
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
        if (event.key === "Escape") close();
      }}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface-raised p-5 shadow-[var(--shadow)]">
        <h2 id="cookie-title" className="text-base font-extrabold">
          La tua privacy
        </h2>
        <p id="cookie-desc" className="mt-2 text-sm leading-6 text-muted">
          {ANALYTICS_CONFIGURED
            ? "Utilizziamo cookie tecnici necessari e, solo se acconsenti, cookie di analisi statistica per migliorare il servizio. Puoi rifiutare senza conseguenze e cambiare idea in qualsiasi momento. "
            : "Al momento utilizziamo solo archiviazione tecnica necessaria: non ci sono cookie facoltativi attivi. "}
          Maggiori informazioni nella{" "}
          <Link className="font-bold text-primary underline" href="/cookie">
            cookie policy
          </Link>
          .
        </p>

        {configuring ? (
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <p className="font-bold">Tecnici necessari</p>
                <p className="mt-1 text-muted">
                  Salvano la tua scelta sui cookie, il tema e i tuoi preferiti.
                  Non possono essere disattivati.
                </p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Cookie tecnici necessari (sempre attivi)"
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
            </div>
            <label
              htmlFor="cookie-analytics"
              className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-3"
            >
              <span>
                <span className="block font-bold">Analitici</span>
                <span className="mt-1 block text-muted">
                  Google Analytics e Microsoft Clarity: misurazione delle visite
                  e registrazione anonimizzata delle interazioni. Attivi solo
                  con il tuo consenso.
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
            Accetta
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => decide(false)}
          >
            Rifiuta
          </button>
          {configuring ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => decide(analyticsChoice)}
            >
              Salva selezione
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
              Personalizza
            </button>
          )}
          {reopened ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={close}
            >
              Chiudi
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
