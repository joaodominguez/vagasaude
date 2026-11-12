"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { districts, professions, sectors } from "@/lib/taxonomies";

export function AlertForm({
  compact = false,
  defaultDistrict = "",
  defaultProfession = "",
  defaultSector = "",
}: {
  compact?: boolean;
  defaultDistrict?: string;
  defaultProfession?: string;
  defaultSector?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState(
    "Ti abbiamo inviato un'email di conferma. Conferma l'iscrizione per attivare l'avviso.",
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
      // Nessuna rete / richiesta interrotta: mostra l'errore invece di restare in caricamento.
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
        "Ti abbiamo inviato un'email di conferma. Conferma l'iscrizione per attivare l'avviso.",
      );
    } else if (data?.needsConfirmation) {
      setMessage(
        "La tua email è stata registrata. Se non ricevi la conferma, ricontrolla più tardi.",
      );
    } else {
      setMessage("Preferenze aggiornate. Il tuo avviso resta attivo.");
    }

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
          <strong className="block">Quasi fatto.</strong>
          {message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? "space-y-3" : "space-y-4"}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">La tua email</span>
        <span className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input
            required
            type="email"
            name="email"
            placeholder="nome@esempio.it"
            autoComplete="email"
          />
        </span>
      </label>

      {!compact ? (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Regione</span>
            <select
              name="district"
              defaultValue={defaultDistrict}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Tutta Italia</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Professione</span>
            <select
              name="profession"
              defaultValue={defaultProfession}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Tutte</option>
              {professions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Settore</span>
            <select
              name="sector"
              defaultValue={defaultSector}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Tutti</option>
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
        Crea avviso gratuito
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          Non è stato possibile creare l’avviso. Riprova.
        </p>
      )}
      {!compact && (
        <p className="text-xs leading-5 text-muted">
          Niente spam. Confermi via email e puoi annullare in qualsiasi momento.
        </p>
      )}
    </form>
  );
}
