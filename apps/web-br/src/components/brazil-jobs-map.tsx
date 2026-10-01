import Link from "next/link";
import { MapPinned } from "lucide-react";
import { categoryPath } from "@/lib/categories";
import { BRAZIL_STATES } from "@/lib/brazil-states";

type BrazilJobsMapProps = {
  counts: Record<string, number>;
  total: number;
};

function stateHref(name: string, count: number) {
  if (count >= 3) return categoryPath(null, name);
  return `/vagas?distrito=${encodeURIComponent(name)}`;
}

export function BrazilJobsMap({ counts, total }: BrazilJobsMapProps) {
  const ranked = BRAZIL_STATES.map((state) => ({
    ...state,
    count: counts[state.name] || 0,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

  const withJobs = ranked.filter((item) => item.count > 0);

  return (
    <div className="portugal-map-panel">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <MapPinned size={18} aria-hidden="true" />
          <span>
            {withJobs.length > 0
              ? `${withJobs.length} estados com vagas · ${total} ofertas`
              : "Vagas por estado (Brasil)"}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ranked.map((state) => {
            const active = state.count > 0;
            return (
              <li key={state.uf}>
                <Link
                  href={stateHref(state.name, state.count)}
                  className={
                    active
                      ? "flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary"
                      : "flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-sm text-muted"
                  }
                >
                  <span>
                    <span className="font-semibold text-foreground">
                      {state.uf}
                    </span>{" "}
                    <span className="text-muted">{state.name}</span>
                  </span>
                  <span className="tabular-nums text-xs text-muted">
                    {state.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
