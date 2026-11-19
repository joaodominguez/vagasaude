"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";

type Props = {
  slug: string;
  size?: number;
  className?: string;
  /** Muestra texto junto al corazón («Guardar» / «Guardada»). */
  withLabel?: boolean;
};

export function FavoriteButton({ slug, size = 18, className = "", withLabel = false }: Props) {
  const { toggle, isFavorite } = useFavorites();
  const active = isFavorite(slug);

  return (
    <button
      type="button"
      aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={active}
      className={`favorite-button ${active ? "is-active" : ""} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
    >
      <Heart
        size={size}
        strokeWidth={active ? 0 : 1.8}
        fill={active ? "currentColor" : "none"}
        aria-hidden="true"
      />
      {withLabel && <span>{active ? "Guardada" : "Guardar"}</span>}
    </button>
  );
}
