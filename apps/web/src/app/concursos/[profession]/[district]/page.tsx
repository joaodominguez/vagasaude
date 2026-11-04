import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConcursosView } from "@/components/concursos-view";
import { getJobs } from "@/lib/jobs-data";
import {
  CONCURSOS_MIN_COMBO,
  buildConcursosMetadata,
  filterConcursos,
  listConcursos,
  resolveConcursoSegments,
} from "@/lib/concursos";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string; district: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: p, district: d } = await params;
  const resolved = resolveConcursoSegments(p, d);
  if (!resolved) return { title: "Concursos não encontrados", robots: { index: false } };
  const count = filterConcursos(
    listConcursos(await getJobs()),
    resolved.profession,
    resolved.district,
  ).length;
  return buildConcursosMetadata(resolved.profession, resolved.district, count);
}

/** /concursos/<profissão>/<distrito>: só com ≥3 procedimentos abertos; caso contrário, 404. */
export default async function ConcursosComboPage({ params }: { params: Params }) {
  const { profession: p, district: d } = await params;
  const resolved = resolveConcursoSegments(p, d);
  if (!resolved?.profession || !resolved.district) notFound();
  const all = listConcursos(await getJobs());
  if (
    filterConcursos(all, resolved.profession, resolved.district).length <
    CONCURSOS_MIN_COMBO
  ) {
    notFound();
  }
  return (
    <ConcursosView all={all} profession={resolved.profession} district={resolved.district} />
  );
}
