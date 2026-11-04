import type { Metadata } from "next";
import { OposicionesView } from "@/components/oposiciones-view";
import { buildOposicionesMetadata, listOposiciones } from "@/lib/oposiciones";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const items = listOposiciones(await getJobs());
  const metadata = buildOposicionesMetadata(null, null, items.length);
  // Sin convocatorias abiertas la página existe (enlace de menú) pero no se indexa.
  return items.length === 0
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

export default async function OposicionesPage() {
  const all = listOposiciones(await getJobs());
  return <OposicionesView all={all} profession={null} district={null} />;
}
