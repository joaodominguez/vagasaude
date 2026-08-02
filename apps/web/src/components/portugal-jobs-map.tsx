import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import {
  PORTUGAL_DISTRICTS,
  PORTUGAL_OUTLINE,
} from "@/lib/portugal-map";

type PortugalJobsMapProps = {
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

export function PortugalJobsMap({ counts, total }: PortugalJobsMapProps) {
  const ranked = PORTUGAL_DISTRICTS.map((district) => ({
    ...district,
    count: counts[district.name] || 0,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt"));

  const max = Math.max(1, ...ranked.map((item) => item.count));
  const withJobs = ranked.filter((item) => item.count > 0);

  return (
    <div className="portugal-map-panel">
      <div className="portugal-map-visual">
        <svg
          viewBox="0 0 200 340"
          className="portugal-map-svg"
          role="img"
          aria-label="Mapa de Portugal com vagas por distrito"
        >
          <defs>
            <linearGradient id="mapSea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--map-sea-from)" />
              <stop offset="100%" stopColor="var(--map-sea-to)" />
            </linearGradient>
          </defs>
          <rect width="200" height="340" rx="28" fill="url(#mapSea)" />
          <path
            d={PORTUGAL_OUTLINE}
            className="portugal-land"
            transform="translate(8 8) scale(0.92)"
          />
          {ranked.map((district) => {
            const active = district.count > 0;
            const radius = active
              ? Math.min(16, 7 + (district.count / max) * 9)
              : 5;
            const marker = (
              <>
                <circle
                  cx={district.x}
                  cy={district.y}
                  r={radius}
                  className={intensityClass(district.count, max)}
                />
                {active && (
                  <text
                    x={district.x}
                    y={district.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="map-marker-label"
                  >
                    {district.count}
                  </text>
                )}
              </>
            );

            if (!active) {
              return (
                <g key={district.name} opacity={0.35}>
                  {marker}
                </g>
              );
            }

            return (
              <a
                key={district.name}
                href={`/vagas?distrito=${encodeURIComponent(district.name)}`}
                aria-label={`${district.count} vagas em ${district.name}`}
                className="map-marker-group"
              >
                {marker}
              </a>
            );
          })}
        </svg>
      </div>

      <div className="portugal-map-list">
        <div className="flex items-start gap-3">
          <span className="feature-icon h-11 w-11">
            <MapPinned size={20} />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.03em]">
              {total} vagas em Portugal
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Clica num distrito para ver as oportunidades dessa zona.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-1.5">
          {withJobs.slice(0, 8).map((district) => (
            <li key={district.name}>
              <Link
                href={`/vagas?distrito=${encodeURIComponent(district.name)}`}
                className="district-row"
              >
                <span>{district.name}</span>
                <span className="district-row-count">
                  {district.count}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {withJobs.length > 8 && (
          <Link
            href="/vagas"
            className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
          >
            Ver todos os distritos
          </Link>
        )}
      </div>
    </div>
  );
}
