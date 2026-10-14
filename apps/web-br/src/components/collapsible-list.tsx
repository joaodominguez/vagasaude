"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleList({
  children,
  limit = 6,
  label = "Ver todos",
  labelCollapse = "Ver menos",
}: {
  children: React.ReactNode;
  limit?: number;
  label?: string;
  labelCollapse?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(children) ? children : [children];
  const total = items.filter(Boolean).length;

  if (total <= limit) {
    return <>{children}</>;
  }

  return (
    <>
      {expanded ? children : items.filter(Boolean).slice(0, limit)}
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <ChevronUp size={13} /> {labelCollapse}
          </>
        ) : (
          <>
            <ChevronDown size={13} /> {label} ({total})
          </>
        )}
      </button>
    </>
  );
}
