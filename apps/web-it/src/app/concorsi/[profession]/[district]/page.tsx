import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConcorsiView } from "@/components/concorsi-view";
import { getJobs } from "@/lib/jobs-data";
import {
  CONCORSI_MIN_COMBO,
  buildConcorsiMetadata,
  filterConcorsi,
  listConcorsi,
  resolveConcorsoSegments,
} from "@/lib/concorsi";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string; district: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: p, district: d } = await params;
  const resolved = resolveConcorsoSegments(p, d);
  if (!resolved) return { title: "Concorsi non trovati", robots: { index: false } };
  const count = filterConcorsi(
    listConcorsi(await getJobs()),
    resolved.profession,
    resolved.district,
  ).length;
  return buildConcorsiMetadata(resolved.profession, resolved.district, count);
}

/** /concorsi/<professione>/<regione>: solo con almeno 3 bandi aperti; altrimenti 404. */
export default async function ConcorsiComboPage({ params }: { params: Params }) {
  const { profession: p, district: d } = await params;
  const resolved = resolveConcorsoSegments(p, d);
  if (!resolved?.profession || !resolved.district) notFound();
  const all = listConcorsi(await getJobs());
  if (
    filterConcorsi(all, resolved.profession, resolved.district).length <
    CONCORSI_MIN_COMBO
  ) {
    notFound();
  }
  return (
    <ConcorsiView all={all} profession={resolved.profession} district={resolved.district} />
  );
}
