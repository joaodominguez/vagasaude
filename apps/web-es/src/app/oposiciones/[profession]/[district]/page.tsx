import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OposicionesView } from "@/components/oposiciones-view";
import { getJobs } from "@/lib/jobs-data";
import {
  OPOSICIONES_MIN_COMBO,
  buildOposicionesMetadata,
  filterOposiciones,
  listOposiciones,
  resolveOposicionSegments,
} from "@/lib/oposiciones";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string; district: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession: p, district: d } = await params;
  const resolved = resolveOposicionSegments(p, d);
  if (!resolved) return { title: "Oposiciones no encontradas", robots: { index: false } };
  const count = filterOposiciones(
    listOposiciones(await getJobs()),
    resolved.profession,
    resolved.district,
  ).length;
  return buildOposicionesMetadata(resolved.profession, resolved.district, count);
}

/** /oposiciones/<profesión>/<comunidad>: solo con ≥3 convocatorias abiertas; si no, 404. */
export default async function OposicionesComboPage({ params }: { params: Params }) {
  const { profession: p, district: d } = await params;
  const resolved = resolveOposicionSegments(p, d);
  if (!resolved?.profession || !resolved.district) notFound();
  const all = listOposiciones(await getJobs());
  if (
    filterOposiciones(all, resolved.profession, resolved.district).length <
    OPOSICIONES_MIN_COMBO
  ) {
    notFound();
  }
  return (
    <OposicionesView all={all} profession={resolved.profession} district={resolved.district} />
  );
}
