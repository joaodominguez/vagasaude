import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import { categoryPath } from "@/lib/categories";
import {
  CANARIAS_INSET,
  SPAIN_MAP_VIEWBOX,
  SPAIN_REGION_PATHS,
  SPAIN_REGIONS,
} from "@/lib/spain-map";

type SpainJobsMapProps = {
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
  return `/empleo?comunidad=${encodeURIComponent(name)}`;
}

export function SpainJobsMap({ counts, total }: SpainJobsMapProps) {
  const ranked = SPAIN_REGIONS.map((region) => ({
    ...region,
    count: counts[region.name] || 0,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  const max = Math.max(1, ...ranked.map((item) => item.count));
  const withJobs = ranked.filter((item) => item.count > 0);

  return (
    <div className="spain-map-panel">
      <div className="spain-map-visual">
        <svg
          viewBox={SPAIN_MAP_VIEWBOX}
          className="spain-map-svg"
          role="img"
          aria-label="Mapa de España con ofertas por comunidad autónoma"
        >
          <rect
            x={CANARIAS_INSET.x}
            y={CANARIAS_INSET.y}
            width={CANARIAS_INSET.width}
            height={CANARIAS_INSET.height}
            rx={4}
            className="spain-inset-frame"
          />
          {Object.entries(SPAIN_REGION_PATHS).map(([name, d]) => (
            <path key={name} d={d} className="spain-land" />
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
                aria-label={`${region.count} ofertas en ${region.name}`}
                className="map-marker-group"
              >
                {marker}
              </a>
            );
          })}
        </svg>
      </div>

      <div className="spain-map-list">
        <div className="flex items-start gap-3">
          <span className="feature-icon h-11 w-11">
            <MapPinned size={20} />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.03em]">
              {total} ofertas en España
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Pulsa en una comunidad para ver las oportunidades de esa zona.
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
            href="/empleo"
            className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
          >
            Ver todas las comunidades
          </Link>
        )}
      </div>
    </div>
  );
}
