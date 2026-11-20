"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CalendarEntry } from "@/lib/calendar";

type Props = {
  entries: CalendarEntry[];
  months: Array<{ key: string; label: string }>;
  dayLabels: Record<string, string>;
  districts: string[];
  professions: string[];
};

/** Calendario mese per mese con filtri regione/professione. L'HTML iniziale contiene tutte le righe (utile ai motori di ricerca). */
export function CalendarView({ entries, months, dayLabels, districts, professions }: Props) {
  const [district, setDistrict] = useState("");
  const [profession, setProfession] = useState("");

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) => (!district || e.district === district) && (!profession || e.profession === profession),
      ),
    [entries, district, profession],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, Map<string, CalendarEntry[]>>();
    for (const e of filtered) {
      const m = e.day.slice(0, 7);
      const days = map.get(m) ?? new Map<string, CalendarEntry[]>();
      days.set(e.day, [...(days.get(e.day) ?? []), e]);
      map.set(m, days);
    }
    return map;
  }, [filtered]);

  const deadlines = filtered.filter((e) => e.kind === "scadenza").length;

  return (
    <div>
      <form
        className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Filtra il calendario"
      >
        <label className="block text-sm font-bold">
          Regione
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
          >
            <option value="">Tutte le regioni</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Professione
          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
          >
            <option value="">Tutte le professioni</option>
            {professions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setDistrict("");
            setProfession("");
          }}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:border-primary hover:text-primary"
        >
          Azzera filtri
        </button>
      </form>

      <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">
        {deadlines === 1 ? "1 scadenza" : `${deadlines} scadenze`} nel calendario
        {district || profession ? " con i filtri scelti" : ""}.
      </p>

      <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Mesi">
        {months.map((m) => (
          <a key={m.key} href={`#m-${m.key}`} className="filter-chip">
            {m.label}
            {` (${[...(byMonth.get(m.key)?.values() ?? [])].reduce((n, l) => n + l.filter((x) => x.kind === "scadenza").length, 0)})`}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        {months.map((m) => {
          const days = byMonth.get(m.key);
          return (
            <section key={m.key} id={`m-${m.key}`} className="scroll-mt-24">
              <h2 className="text-xl font-extrabold capitalize tracking-[-0.03em]">{m.label}</h2>
              {!days || days.size === 0 ? (
                <p className="mt-3 text-sm text-muted">Nessuna scadenza con i filtri scelti.</p>
              ) : (
                <ol className="mt-4 space-y-5">
                  {[...days.entries()].map(([day, list]) => (
                    <li key={day}>
                      <h3 className="text-sm font-extrabold capitalize text-primary">{dayLabels[day]}</h3>
                      <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
                        {list.map((e) => (
                          <li key={e.id} className="px-4 py-3">
                            <Link href={`/offerte/${e.slug}`} prefetch={false} className="font-semibold leading-snug hover:text-primary">
                              {e.title}
                            </Link>
                            <span className="mt-0.5 block text-sm text-muted">
                              {e.company}
                              {e.district ? ` · ${e.district}` : ""}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                              <span className={e.kind === "prova" ? "tag tag-primary" : "tag tag-deadline"}>{e.label}</span>
                              <span className="tag">{e.typeLabel}</span>
                              <span className="tag">{e.profession}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
