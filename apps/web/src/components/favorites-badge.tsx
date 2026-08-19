"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";

export function FavoritesBadge() {
  const { count } = useFavorites();
  if (count === 0) return null;

  return (
    <Link
      href="/favoritos"
      className="favorites-badge"
      aria-label={`${count} vaga${count === 1 ? "" : "s"} guardada${count === 1 ? "" : "s"}`}
    >
      <Heart size={16} strokeWidth={1.8} />
      <span className="favorites-badge-count">{count > 99 ? "99+" : count}</span>
    </Link>
  );
}
