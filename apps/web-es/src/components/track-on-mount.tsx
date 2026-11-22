"use client";

import { useEffect, useRef } from "react";
import { trackEvent, type TrackEventName } from "@/lib/track-event";

/** Dispara um evento uma vez ao montar (ex.: página de confirmação do alerta). */
export function TrackOnMount({ event }: { event: TrackEventName }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    trackEvent(event);
  }, [event]);
  return null;
}
