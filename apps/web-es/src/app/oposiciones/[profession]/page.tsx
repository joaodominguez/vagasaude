import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OposicionesView } from "@/components/oposiciones-view";
import { getJobs } from "@/lib/jobs-data";
import {
  OPOSICIONES_MIN_PROFESSION,
  buildOposicionesMetadata,
  filterOposiciones,
  listOposiciones,
  resolveOposicionSegments,
} from "@/lib/oposiciones";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: slug } = await params;
  const resolved = resolveOposicionSegments(slug);
  if (!resolved) return { title: "Oposiciones no encontradas", robots: { index: false } };
  const count = filterOposiciones(
    listOposiciones(await getJobs()),
    resolved.profession,
    null,
  ).length;
  return buildOposicionesMetadata(resolved.profession, null, count);
}

/** /oposiciones/<profesión>: solo existe con ≥1 convocatoria abierta; si no, 404. */
export default async function OposicionesProfessionPage({ params }: { params: Params }) {
  const { profession: slug } = await params;
  const resolved = resolveOposicionSegments(slug);
  if (!resolved?.profession) notFound();
  const all = listOposiciones(await getJobs());
  if (filterOposiciones(all, resolved.profession, null).length < OPOSICIONES_MIN_PROFESSION) {
    notFound();
  }
  return <OposicionesView all={all} profession={resolved.profession} district={null} />;
}
