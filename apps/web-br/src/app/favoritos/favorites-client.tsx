"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import type { Job } from "@/lib/jobs";
import { JobCard } from "@/components/job-card";

export function FavoritesClient() {
  const { slugs, toggle } = useFavorites();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const slugsKey = slugs.join(",");

  useEffect(() => {
    if (!slugsKey) {
      setJobs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/favorites?slugs=${encodeURIComponent(slugsKey)}`)
      .then((res) => (res.ok ? res.json() : { jobs: [] }))
      .then((data: { jobs: Job[] }) => {
        if (!cancelled) {
          const currentSlugs = slugsKey.split(",");
          const ordered = currentSlugs
            .map((s) => data.jobs.find((j) => j.slug === s))
            .filter(Boolean) as Job[];
          setJobs(ordered);
        }
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        A carregar favoritos...
      </p>
    );
  }

  if (slugs.length === 0) {
    return (
      <div className="content-card px-6 py-14 text-center">
        <Heart size={36} className="mx-auto text-muted" strokeWidth={1.4} />
        <h2 className="mt-4 text-xl font-extrabold">Ainda sem favoritos</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Carrega no coração em qualquer vaga para a guardar aqui.
        </p>
        <Link className="button button-primary mt-6 inline-flex" href="/vagas">
          Ver vagas
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {jobs.length} vaga{jobs.length !== 1 ? "s" : ""} guardada
          {jobs.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-danger hover:underline"
          onClick={() => {
            if (confirm("Limpar todos os favoritos?")) {
              for (const slug of slugs) toggle(slug);
            }
          }}
        >
          <Trash2 size={14} /> Limpar tudo
        </button>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.slug} job={job} />
        ))}
        {slugs.length > jobs.length && (
          <p className="mt-4 text-sm text-muted">
            {slugs.length - jobs.length === 1
              ? "1 vaga guardada já não está disponível."
              : `${slugs.length - jobs.length} vagas guardadas já não estão disponíveis.`}
          </p>
        )}
      </div>
    </>
  );
}
