import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConcursosView } from "@/components/concursos-view";
import { getJobs } from "@/lib/jobs-data";
import {
  CONCURSOS_MIN_PROFESSION,
  buildConcursosMetadata,
  filterConcursos,
  listConcursos,
  resolveConcursoSegments,
} from "@/lib/concursos-hub";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: slug } = await params;
  const resolved = resolveConcursoSegments(slug);
  if (!resolved) return { title: "Concursos não encontrados", robots: { index: false } };
  const count = filterConcursos(listConcursos(await getJobs()), resolved.profession, null).length;
  const metadata = buildConcursosMetadata(resolved.profession, null, count);
  return count < CONCURSOS_MIN_PROFESSION
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

/** /concursos/<profissão>: só existe com ≥1 edital aberto; senão 404. */
export default async function ConcursosProfessionPage({ params }: { params: Params }) {
  const { profession: slug } = await params;
  const resolved = resolveConcursoSegments(slug);
  if (!resolved?.profession) notFound();
  const all = listConcursos(await getJobs());
  if (filterConcursos(all, resolved.profession, null).length < CONCURSOS_MIN_PROFESSION) {
    notFound();
  }
  return <ConcursosView all={all} profession={resolved.profession} district={null} />;
}
