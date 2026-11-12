import type { Metadata } from "next";
import { ConcorsiView } from "@/components/concorsi-view";
import { buildConcorsiMetadata, listConcorsi } from "@/lib/concorsi";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const items = listConcorsi(await getJobs());
  const metadata = buildConcorsiMetadata(null, null, items.length);
  // Senza bandi aperti la pagina esiste ma non viene indicizzata.
  return items.length === 0
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

export default async function ConcorsiPage() {
  const all = listConcorsi(await getJobs());
  return <ConcorsiView all={all} profession={null} district={null} />;
}
