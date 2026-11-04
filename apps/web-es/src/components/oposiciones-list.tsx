"use client";

import { useState, type ReactNode } from "react";

export type OposicionesListItem = {
  key: string;
  profession: string;
  district: string;
  type: string;
  typeLabel: string;
  node: ReactNode;
};

/**
 * Filtros en cliente sobre tarjetas ya renderizadas en el servidor: el HTML
 * inicial contiene todas las convocatorias (indexable) y el filtrado es instantáneo.
 */
export function OposicionesList({
  items,
  showProfessionFilter = true,
}: {
  items: OposicionesListItem[];
  showProfessionFilter?: boolean;
}) {
  const [profession, setProfession] = useState("");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");

  const options = (pick: (item: OposicionesListItem) => [string, string]) => {
    const map = new Map<string, string>();
    for (const item of items) {
      const [value, label] = pick(item);
      if (value) map.set(value, label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
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
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
        {showProfessionFilter && professions.length > 1 && (
          <select
            aria-label="Profesión"
            className={selectClass}
            value={profession}
            onChange={(event) => setProfession(event.target.value)}
          >
            <option value="">Todas las profesiones</option>
            {professions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {districts.length > 1 && (
          <select
            aria-label="Comunidad autónoma"
            className={selectClass}
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          >
            <option value="">Todas las comunidades</option>
            {districts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {types.length > 1 && (
          <select
            aria-label="Tipo de convocatoria"
            className={selectClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Todos los tipos</option>
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
            Quitar filtros
          </button>
        )}
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {visible.length} {visible.length === 1 ? "convocatoria" : "convocatorias"}
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
          <p className="font-extrabold">No hay convocatorias con esos filtros</p>
          <p className="mt-1 text-sm text-muted">
            Prueba a quitar algún filtro o crea una alerta para recibir las nuevas.
          </p>
        </div>
      )}
    </div>
  );
}
