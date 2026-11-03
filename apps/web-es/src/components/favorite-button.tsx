"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";

type Props = {
  slug: string;
  size?: number;
  className?: string;
};

export function FavoriteButton({ slug, size = 18, className = "" }: Props) {
  const { toggle, isFavorite } = useFavorites();
  const active = isFavorite(slug);

  return (
    <button
      type="button"
      aria-label={active ? "Remover dos favoritos" : "Guardar nos favoritos"}
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
      />
    </button>
  );
}
