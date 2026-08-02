"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { districts, professions, sectors } from "@/lib/taxonomies";

export function AlertForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState(
    "Enviámos um email de confirmação. Confirma a inscrição para activar o alerta.",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        district: form.get("district") || null,
        profession: form.get("profession") || null,
        sector: form.get("sector") || null,
      }),
    });

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
        "Enviámos um email de confirmação. Confirma a inscrição para activar o alerta.",
      );
    } else if (data?.needsConfirmation) {
      setMessage(
        "O teu email ficou registado. Se não receberes a confirmação, verifica mais tarde.",
      );
    } else {
      setMessage("Preferências actualizadas. O teu alerta continua activo.");
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-success">
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
        <p>
          <strong className="block">Quase pronto.</strong>
          {message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? "space-y-3" : "space-y-4"}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">O teu email</span>
        <span className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input
            required
            type="email"
            name="email"
            placeholder="nome@exemplo.pt"
            autoComplete="email"
          />
        </span>
      </label>

      {!compact ? (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Distrito</span>
            <select
              name="district"
              defaultValue=""
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Todo o país</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Profissão</span>
            <select
              name="profession"
              defaultValue=""
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
              defaultValue=""
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
      ) : null}

      <button
        className="button button-primary w-full"
        type="submit"
        disabled={status === "loading"}
      >
        {status === "loading" && (
          <LoaderCircle className="animate-spin" size={17} />
        )}
        Criar alerta gratuito
      </button>
      {status === "error" && (
        <p className="text-sm text-danger">
          Não foi possível criar o alerta. Tenta novamente.
        </p>
      )}
      {!compact && (
        <p className="text-xs leading-5 text-muted">
          Sem spam. Confirmas por email e podes cancelar a qualquer momento.
        </p>
      )}
    </form>
  );
}
