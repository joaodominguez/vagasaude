"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";

export function FavoritesBadge() {
  const { count } = useFavorites();
  if (count === 0) return null;

  return (
    <Link
      href="/preferiti"
      className="favorites-badge"
      aria-label={`${count} ${count === 1 ? "offerta salvata" : "offerte salvate"}`}
    >
      <Heart size={16} strokeWidth={1.8} />
      <span className="favorites-badge-count">{count > 99 ? "99+" : count}</span>
    </Link>
  );
}
