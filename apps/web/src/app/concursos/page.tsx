import type { Metadata } from "next";
import { ConcursosView } from "@/components/concursos-view";
import { buildConcursosMetadata, listConcursos } from "@/lib/concursos";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const items = listConcursos(await getJobs());
  const metadata = buildConcursosMetadata(null, null, items.length);
  // Sem procedimentos abertos a página existe (link de menu) mas não se indexa.
  return items.length === 0
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

export default async function ConcursosPage() {
  const all = listConcursos(await getJobs());
  return <ConcursosView all={all} profession={null} district={null} />;
}
