import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import { categoryPath } from "@/lib/categories";
import {
  ITALY_MAP_VIEWBOX,
  ITALY_REGION_PATHS,
  ITALY_REGIONS,
} from "@/lib/italy-map";

type ItalyJobsMapProps = {
  counts: Record<string, number>;
  total: number;
};

function intensityClass(count: number, max: number) {
  if (count <= 0) return "map-marker-empty";
  const ratio = count / max;
  if (ratio > 0.66) return "map-marker-hot";
  if (ratio > 0.33) return "map-marker-mid";
  return "map-marker-low";
}

function regionHref(name: string, count: number) {
  if (count >= 3) return categoryPath(null, name);
  return `/offerte?regione=${encodeURIComponent(name)}`;
}

export function ItalyJobsMap({ counts, total }: ItalyJobsMapProps) {
  const ranked = ITALY_REGIONS.map((region) => ({
    ...region,
    count: counts[region.name] || 0,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));

  const max = Math.max(1, ...ranked.map((item) => item.count));
  const withJobs = ranked.filter((item) => item.count > 0);

  return (
    <div className="italy-map-panel">
      <div className="italy-map-visual">
        <svg
          viewBox={ITALY_MAP_VIEWBOX}
          className="italy-map-svg"
          role="img"
          aria-label="Mappa dell'Italia con le offerte per regione"
        >
          {Object.entries(ITALY_REGION_PATHS).map(([name, d]) => (
            <path key={name} d={d} className="italy-land" />
          ))}

          {ranked.map((region) => {
            const active = region.count > 0;
            const radius = active
              ? Math.min(14, 6.5 + (region.count / max) * 7.5)
              : 4;
            const marker = (
              <>
                <circle
                  cx={region.x}
                  cy={region.y}
                  r={radius}
                  className={intensityClass(region.count, max)}
                />
                {active && (
                  <text
                    x={region.x}
                    y={region.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="map-marker-label"
                  >
                    {region.count}
                  </text>
                )}
              </>
            );

            if (!active) {
              return (
                <g key={region.name} opacity={0.35}>
                  {marker}
                </g>
              );
            }

            return (
              <a
                key={region.name}
                href={regionHref(region.name, region.count)}
                aria-label={`${region.count} offerte in ${region.name}`}
                className="map-marker-group"
              >
                {marker}
              </a>
            );
          })}
        </svg>
      </div>

      <div className="italy-map-list">
        <div className="flex items-start gap-3">
          <span className="feature-icon h-11 w-11">
            <MapPinned size={20} />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.03em]">
              {total} offerte in Italia
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Seleziona una regione per vedere le opportunità di quella zona.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-1.5">
          {withJobs.slice(0, 8).map((region) => (
            <li key={region.name}>
              <Link
                href={regionHref(region.name, region.count)}
                className="district-row"
              >
                <span>{region.name}</span>
                <span className="district-row-count">
                  {region.count}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {withJobs.length > 8 && (
          <Link
            href="/offerte"
            className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
          >
            Vedi tutte le regioni
          </Link>
        )}
      </div>
    </div>
  );
}
