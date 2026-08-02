"use client";

import { FormEvent, useState } from "react";
import { districts, professions, sectors } from "@/lib/taxonomies";
import type { AlertFilters, AlertStatus } from "@/lib/alerts";

type Props = {
  token: string;
  email: string;
  status: AlertStatus;
  filters: AlertFilters;
};

export function ManageAlertClient({ token, email, status, filters }: Props) {
  const [district, setDistrict] = useState(filters.district ?? "");
  const [profession, setProfession] = useState(filters.profession ?? "");
  const [sector, setSector] = useState(filters.sector ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gone, setGone] = useState(status === "unsubscribed");

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/alerts/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "update",
          district: district || null,
          profession: profession || null,
          sector: sector || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Não foi possível guardar.");
        return;
      }
      setMessage("Preferências actualizadas.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!window.confirm("Cancelar este alerta?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "unsubscribe" }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error || "Não foi possível cancelar.");
        return;
      }
      setGone(true);
      setMessage("Alerta cancelado. Já não vais receber emails.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  if (gone) {
    return (
      <p className="rounded-xl bg-success-soft p-4 text-sm text-success">
        {message || "Esta inscrição está cancelada."}
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={save}>
      <p className="text-sm text-muted">
        Email: <strong className="text-foreground">{email}</strong>
        {status === "pending_confirm" ? (
          <span className="mt-1 block text-xs text-danger">
            Ainda falta confirmar o email — verifica a caixa de entrada.
          </span>
        ) : null}
      </p>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Distrito</span>
        <select
          value={district}
          onChange={(event) => setDistrict(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Todo o país</option>
          {districts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Profissão</span>
        <select
          value={profession}
          onChange={(event) => setProfession(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Todas</option>
          {professions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Sector</span>
        <select
          value={sector}
          onChange={(event) => setSector(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Todos</option>
          {sectors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          className="button button-primary"
          disabled={loading}
        >
          {loading ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={loading}
          onClick={unsubscribe}
        >
          Cancelar alerta
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
