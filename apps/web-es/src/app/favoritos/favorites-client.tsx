"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import type { Job } from "@/lib/jobs";
import { JobCard } from "@/components/job-card";

export function FavoritesClient() {
  const { slugs, toggle } = useFavorites();
  const [fetched, setFetched] = useState<{ key: string; jobs: Job[] }>({
    key: "",
    jobs: [],
  });

  const slugsKey = slugs.join(",");
  const loading = slugsKey !== "" && fetched.key !== slugsKey;
  const jobs = slugsKey ? fetched.jobs : [];

  useEffect(() => {
    if (!slugsKey) return;
    let cancelled = false;
    fetch(`/api/favorites?slugs=${encodeURIComponent(slugsKey)}`)
      .then((res) => (res.ok ? res.json() : { jobs: [] }))
      .then((data: { jobs: Job[] }) => {
        const ordered = slugsKey
          .split(",")
          .map((s) => data.jobs.find((j) => j.slug === s))
          .filter(Boolean) as Job[];
        if (!cancelled) setFetched({ key: slugsKey, jobs: ordered });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: slugsKey, jobs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Cargando favoritos...
      </p>
    );
  }

  if (slugs.length === 0) {
    return (
      <div className="content-card px-6 py-14 text-center">
        <Heart size={36} className="mx-auto text-muted" strokeWidth={1.4} />
        <h2 className="mt-4 text-xl font-extrabold">Todavía sin favoritos</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Pulsa el corazón en cualquier oferta para guardarla aquí.
        </p>
        <Link className="button button-primary mt-6 inline-flex" href="/empleo">
          Ver ofertas
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {jobs.length} oferta{jobs.length !== 1 ? "s" : ""} guardada
          {jobs.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-danger hover:underline"
          onClick={() => {
            if (confirm("¿Borrar todos los favoritos?")) {
              for (const slug of slugs) toggle(slug);
            }
          }}
        >
          <Trash2 size={14} /> Borrar todo
        </button>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.slug} job={job} />
        ))}
        {slugs.length > jobs.length && (
          <p className="mt-4 text-sm text-muted">
            {slugs.length - jobs.length === 1
              ? "1 oferta guardada ya no está disponible."
              : `${slugs.length - jobs.length} ofertas guardadas ya no están disponibles.`}
          </p>
        )}
      </div>
    </>
  );
}
