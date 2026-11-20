import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypeView } from "@/components/type-view";
import { listConcorsi } from "@/lib/concorsi";
import { itemsOfType, typeMetadata, typePageBySlug } from "@/lib/concorsi-hubs";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ tipo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = typePageBySlug((await params).tipo);
  if (!page) return { title: "Pagina non trovata", robots: { index: false } };
  return typeMetadata(page, itemsOfType(listConcorsi(await getJobs()), page.type).length);
}

export default async function ConcorsiTypePage({ params }: { params: Params }) {
  const page = typePageBySlug((await params).tipo);
  if (!page) notFound();
  return <TypeView all={listConcorsi(await getJobs())} page={page} />;
}
