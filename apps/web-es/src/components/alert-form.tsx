"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { trackEvent } from "@/lib/track-event";
import { districts, professions, sectors } from "@/lib/taxonomies";

export function AlertForm({
  band = false,
  compact = false,
  defaultDistrict = "",
  defaultProfession = "",
  defaultSector = "",
}: {
  /** Variante de la banda «Alertas» de la home (sobre fondo oscuro): selectores en fila + email + botón. */
  band?: boolean;
  compact?: boolean;
  defaultDistrict?: string;
  defaultProfession?: string;
  defaultSector?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState(
    "Te hemos enviado un email de confirmación. Confirma la suscripción para activar la alerta.",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          district: form.get("district") || null,
          profession: form.get("profession") || null,
          sector: form.get("sector") || null,
        }),
      });
    } catch {
      // Sem rede / pedido interrompido: mostrar o erro em vez de ficar a carregar para sempre.
      setStatus("error");
      return;
    }

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const data = (await response.json().catch(() => null)) as {
      emailSent?: boolean;
      needsConfirmation?: boolean;
      message?: string;
    } | null;

    if (data?.message) {
      setMessage(data.message);
    } else if (data?.needsConfirmation && data.emailSent) {
      setMessage(
        "Te hemos enviado un email de confirmación. Confirma la suscripción para activar la alerta.",
      );
    } else if (data?.needsConfirmation) {
      setMessage(
        "Tu email ha quedado registrado. Si no recibes la confirmación, revísalo más tarde.",
      );
    } else {
      setMessage("Preferencias actualizadas. Tu alerta sigue activa.");
    }

    trackEvent("alert_signup");
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-success"
      >
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
        <p>
          <strong className="block">Casi listo.</strong>
          {message}
        </p>
      </div>
    );
  }

  if (band) {
    return (
      <form onSubmit={submit} className="alert-band-form">
        <div className="alert-band-row">
          <label>
            <span className="sr-only">Profesión</span>
            <select name="profession" defaultValue={defaultProfession}>
              <option value="">Todas las profesiones</option>
              {professions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Comunidad</span>
            <select name="district" defaultValue={defaultDistrict}>
              <option value="">Toda España</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input type="hidden" name="sector" value={defaultSector} />
        <label>
          <span className="sr-only">Tu email</span>
          <input
            required
            type="email"
            name="email"
            placeholder="nombre@ejemplo.es"
            autoComplete="email"
            inputMode="email"
          />
        </label>
        <button className="alert-band-submit" type="submit" disabled={status === "loading"}>
          {status === "loading" && <LoaderCircle className="animate-spin" size={17} />}
          Crear alerta gratis
        </button>
        {status === "error" && (
          <p role="alert" className="alert-band-error">
            No se ha podido crear la alerta. Inténtalo de nuevo.
          </p>
        )}
        <small>Sin spam. Solo ofertas nuevas que encajen con tu elección. Los emails miden aperturas y clics para mejorar el servicio.</small>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? "space-y-3" : "space-y-4"}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Tu email</span>
        <span className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input
            required
            type="email"
            name="email"
            placeholder="nombre@ejemplo.es"
            autoComplete="email"
          />
        </span>
      </label>

      {!compact ? (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Comunidad autónoma</span>
            <select
              name="district"
              defaultValue={defaultDistrict}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Toda España</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Profesión</span>
            <select
              name="profession"
              defaultValue={defaultProfession}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Todas</option>
              {professions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Sector</span>
            <select
              name="sector"
              defaultValue={defaultSector}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Todos</option>
              {sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="district" value={defaultDistrict} />
          <input type="hidden" name="profession" value={defaultProfession} />
          <input type="hidden" name="sector" value={defaultSector} />
        </>
      )}

      <button
        className="button button-primary w-full"
        type="submit"
        disabled={status === "loading"}
      >
        {status === "loading" && (
          <LoaderCircle className="animate-spin" size={17} />
        )}
        Crear alerta gratuita
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          No se ha podido crear la alerta. Inténtalo de nuevo.
        </p>
      )}
      <p className="text-xs leading-5 text-muted">
        {!compact && "Sin spam. Confirmas por email y puedes cancelar en cualquier momento. "}
        Los emails miden aperturas y clics para mejorar el servicio.
      </p>
    </form>
  );
}
