import Link from "next/link";
import { MapPinned } from "lucide-react";
import { categoryPath } from "@/lib/categories";
import {
  BRAZIL_MAP_VIEWBOX,
  BRAZIL_STATE_CENTROIDS,
  BRAZIL_STATE_PATHS,
} from "@/lib/brazil-map";
import { BRAZIL_STATES } from "@/lib/brazil-states";

type BrazilJobsMapProps = {
  counts: Record<string, number>;
  total: number;
};

/** Sqrt intensity so SP outliers don't flatten every other UF to "low". */
function densityRatio(count: number, max: number) {
  if (count <= 0 || max <= 0) return 0;
  return Math.sqrt(count / max);
}

function intensityClass(count: number, max: number) {
  if (count <= 0) return "brazil-state-empty";
  const ratio = densityRatio(count, max);
  if (ratio > 0.66) return "brazil-state-hot";
  if (ratio > 0.33) return "brazil-state-mid";
  return "brazil-state-low";
}

function markerClass(count: number, max: number) {
  if (count <= 0) return "map-marker-empty";
  const ratio = densityRatio(count, max);
  if (ratio > 0.66) return "map-marker-hot";
  if (ratio > 0.33) return "map-marker-mid";
  return "map-marker-low";
}

/**
 * Compact radii so coastal NE/SE bubbles stay on land (viewBox 500² is
 * denser than Portugal's tall map).
 */
function markerRadius(count: number, max: number) {
  if (count <= 0) return 3.5;
  const digits = String(count).length;
  const base = digits >= 4 ? 11 : digits === 3 ? 7.5 : digits === 2 ? 6 : 5;
  const span = digits >= 4 ? 3 : digits === 3 ? 2.5 : 2;
  const cap = digits >= 4 ? 14 : digits === 3 ? 10 : 8;
  return Math.min(cap, base + densityRatio(count, max) * span);
}

function stateHref(name: string, count: number) {
  if (count >= 3) return categoryPath(null, name);
  return `/vagas?distrito=${encodeURIComponent(name)}`;
}

export function BrazilJobsMap({ counts, total }: BrazilJobsMapProps) {
  const ranked = BRAZIL_STATES.map((state) => ({
    ...state,
    count: counts[state.name] || 0,
    path: BRAZIL_STATE_PATHS[state.uf] || "",
    centroid: BRAZIL_STATE_CENTROIDS[state.uf],
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

  const max = Math.max(1, ...ranked.map((item) => item.count));
  const withJobs = ranked.filter((item) => item.count > 0);

  return (
    <div className="portugal-map-panel brazil-map-panel">
      <div className="portugal-map-list brazil-map-list">
        <div className="mb-4 flex items-start gap-3">
          <span className="feature-icon h-11 w-11 shrink-0">
            <MapPinned size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.03em]">
              {withJobs.length > 0
                ? `${withJobs.length} estados com vagas · ${total} ofertas`
                : "Vagas por estado (Brasil)"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Clique num estado no mapa ou na lista para ver as oportunidades.
            </p>
          </div>
        </div>
        <ul className="brazil-map-uf-grid">
          {ranked.map((state) => {
            const active = state.count > 0;
            return (
              <li key={state.uf}>
                <Link
                  href={stateHref(state.name, state.count)}
                  className={
                    active
                      ? "brazil-map-uf-card brazil-map-uf-card-active"
                      : "brazil-map-uf-card"
                  }
                  aria-label={
                    active
                      ? `${state.count} vagas em ${state.name}`
                      : `${state.name}: sem vagas no momento`
                  }
                >
                  <span className="brazil-map-uf-name">
                    <span className="font-semibold text-foreground">
                      {state.uf}
                    </span>{" "}
                    <span className="text-muted">{state.name}</span>
                  </span>
                  <span className="brazil-map-uf-count tabular-nums">
                    {state.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="portugal-map-visual brazil-map-visual">
        <svg
          viewBox={BRAZIL_MAP_VIEWBOX}
          className="portugal-map-svg brazil-map-svg"
          role="img"
          aria-label="Mapa do Brasil com vagas por estado"
        >
          <defs>
            <linearGradient id="brazilMapSea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--map-sea-from)" />
              <stop offset="100%" stopColor="var(--map-sea-to)" />
            </linearGradient>
          </defs>
          <rect width="500" height="500" rx="28" fill="url(#brazilMapSea)" />

          {ranked.map((state) => {
            if (!state.path) return null;
            const active = state.count > 0;
            const pathEl = (
              <path
                d={state.path}
                className={`brazil-state ${intensityClass(state.count, max)}`}
              />
            );

            if (!active) {
              return (
                <g
                  key={state.uf}
                  className="brazil-state-group brazil-state-group-empty"
                  aria-hidden="true"
                >
                  {pathEl}
                  <title>{`${state.name} (${state.uf}): sem vagas`}</title>
                </g>
              );
            }

            return (
              <a
                key={state.uf}
                href={stateHref(state.name, state.count)}
                aria-label={`${state.count} vagas em ${state.name}`}
                className="brazil-state-group"
              >
                {pathEl}
                <title>{`${state.name} (${state.uf}): ${state.count} vagas`}</title>
              </a>
            );
          })}

          {/* Count bubbles on top (Portugal-style), so numbers stay readable */}
          {ranked.map((state) => {
            if (!state.centroid) return null;
            const { x, y } = state.centroid;
            const active = state.count > 0;
            const radius = markerRadius(state.count, max);
            const marker = (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  className={`brazil-map-marker ${markerClass(state.count, max)}`}
                />
                {active && (
                  <text
                    x={x}
                    y={y + 0.6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`map-marker-label brazil-map-marker-label${
                      String(state.count).length >= 4
                        ? " brazil-map-marker-label-xl"
                        : String(state.count).length >= 3
                          ? " brazil-map-marker-label-lg"
                          : ""
                    }`}
                  >
                    {state.count}
                  </text>
                )}
              </>
            );

            if (!active) {
              return (
                <g key={`m-${state.uf}`} opacity={0.35} aria-hidden="true">
                  {marker}
                </g>
              );
            }

            return (
              <a
                key={`m-${state.uf}`}
                href={stateHref(state.name, state.count)}
                aria-label={`${state.count} vagas em ${state.name}`}
                className="map-marker-group brazil-map-marker-group"
              >
                {marker}
              </a>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
