"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "vagasaude-favorites";

let listeners: Array<() => void> = [];

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function readSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {}
  emit();
}

let snapshot: string[] = readSlugs();

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return [] as string[];
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      snapshot = readSlugs();
      emit();
    }
  });
}

function refresh() {
  snapshot = readSlugs();
}

export function useFavorites() {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    refresh();
    emit();
  }, []);

  const toggle = useCallback((slug: string) => {
    refresh();
    const current = readSlugs();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [slug, ...current];
    snapshot = next;
    writeSlugs(next);
  }, []);

  const isFavorite = useCallback(
    (slug: string) => slugs.includes(slug),
    [slugs],
  );

  return { slugs, count: slugs.length, toggle, isFavorite };
}
