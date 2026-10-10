"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export function MobileFilterSheet({
  children,
  activeCount,
}: {
  children: React.ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="filter-sheet-trigger lg:hidden"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} />
        Filtros
        {activeCount > 0 && (
          <span className="filter-sheet-badge">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="filter-sheet-overlay" onClick={() => setOpen(false)}>
          <div
            className="filter-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-sheet-header">
              <span className="font-extrabold">Filtros</span>
              <button
                type="button"
                className="icon-button"
                style={{ minHeight: "2.25rem", minWidth: "2.25rem" }}
                aria-label="Fechar filtros"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="filter-sheet-body" onClick={() => setOpen(false)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
