"use client";

import { useState, type ReactNode } from "react";

export type ConcorsiListItem = {
  key: string;
  profession: string;
  district: string;
  type: string;
  typeLabel: string;
  node: ReactNode;
};

/**
 * Filtri lato client su schede già renderizzate sul server: l'HTML iniziale
 * contiene tutti i bandi (indicizzabile) e il filtraggio è istantaneo.
 */
export function ConcorsiList({
  items,
  showProfessionFilter = true,
}: {
  items: ConcorsiListItem[];
  showProfessionFilter?: boolean;
}) {
  const [profession, setProfession] = useState("");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");

  const options = (pick: (item: ConcorsiListItem) => [string, string]) => {
    const map = new Map<string, string>();
    for (const item of items) {
      const [value, label] = pick(item);
      if (value) map.set(value, label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "it"));
  };
  const professions = options((i) => [i.profession, i.profession]);
  const districts = options((i) => [i.district, i.district]);
  const types = options((i) => [i.type, i.typeLabel]);

  const visible = items.filter(
    (item) =>
      (!profession || item.profession === profession) &&
      (!district || item.district === district) &&
      (!type || item.type === type),
  );
  const active = Boolean(profession || district || type);

  const selectClass =
    "min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filtri">
        {showProfessionFilter && professions.length > 1 && (
          <select
            aria-label="Professione"
            className={selectClass}
            value={profession}
            onChange={(event) => setProfession(event.target.value)}
          >
            <option value="">Tutte le professioni</option>
            {professions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {districts.length > 1 && (
          <select
            aria-label="Regione"
            className={selectClass}
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          >
            <option value="">Tutte le regioni</option>
            {districts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {types.length > 1 && (
          <select
            aria-label="Tipo di bando"
            className={selectClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Tutti i tipi</option>
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {active && (
          <button
            type="button"
            className="text-sm font-bold text-primary hover:underline"
            onClick={() => {
              setProfession("");
              setDistrict("");
              setType("");
            }}
          >
            Rimuovi i filtri
          </button>
        )}
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {visible.length} {visible.length === 1 ? "bando" : "bandi"}
        </p>
      </div>

      {visible.length > 0 ? (
        <div className="min-w-0 space-y-3">
          {visible.map((item) => (
            <div key={item.key}>{item.node}</div>
          ))}
        </div>
      ) : (
        <div className="content-card px-6 py-12 text-center">
          <p className="font-extrabold">Nessun bando con questi filtri</p>
          <p className="mt-1 text-sm text-muted">
            Prova a rimuovere qualche filtro oppure crea un avviso per ricevere i nuovi bandi.
          </p>
        </div>
      )}
    </div>
  );
}
