import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConcorsiView } from "@/components/concorsi-view";
import { getJobs } from "@/lib/jobs-data";
import {
  CONCORSI_MIN_PROFESSION,
  buildConcorsiMetadata,
  filterConcorsi,
  listConcorsi,
  resolveConcorsoSegments,
} from "@/lib/concorsi";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: slug } = await params;
  const resolved = resolveConcorsoSegments(slug);
  if (!resolved) return { title: "Concorsi non trovati", robots: { index: false } };
  const count = filterConcorsi(
    listConcorsi(await getJobs()),
    resolved.profession,
    null,
  ).length;
  return buildConcorsiMetadata(resolved.profession, null, count);
}

/** /concorsi/<professione>: esiste solo con almeno 1 bando aperto; altrimenti 404. */
export default async function ConcorsiProfessionPage({ params }: { params: Params }) {
  const { profession: slug } = await params;
  const resolved = resolveConcorsoSegments(slug);
  if (!resolved?.profession) notFound();
  const all = listConcorsi(await getJobs());
  if (filterConcorsi(all, resolved.profession, null).length < CONCORSI_MIN_PROFESSION) {
    notFound();
  }
  return <ConcorsiView all={all} profession={resolved.profession} district={null} />;
}
