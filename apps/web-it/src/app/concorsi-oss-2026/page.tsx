import type { Metadata } from "next";
import { HubView } from "@/components/hub-view";
import { filterConcorsi, listConcorsi } from "@/lib/concorsi";
import { HUBS, hubMetadata } from "@/lib/concorsi-hubs";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

const hub = HUBS.find((item) => item.slug === "concorsi-oss-2026")!;

export async function generateMetadata(): Promise<Metadata> {
  const all = listConcorsi(await getJobs());
  return hubMetadata(hub, filterConcorsi(all, hub.profession, null).length);
}

export default async function HubPage() {
  const jobs = await getJobs();
  return <HubView hub={hub} all={listConcorsi(jobs)} jobs={jobs} />;
}
