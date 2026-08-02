"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

export function AlertForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setStatus(response.ok ? "success" : "error");
  }

  if (status === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-success">
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
        <p>
          <strong className="block">Alerta criado.</strong>
          O teu email ficou registado para receber novas oportunidades.
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
          Sem spam. Podes cancelar a qualquer momento.
        </p>
      )}
    </form>
  );
}
