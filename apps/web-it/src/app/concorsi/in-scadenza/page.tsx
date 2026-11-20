import type { Metadata } from "next";
import { ExpiringView } from "@/components/expiring-view";
import { listConcorsi } from "@/lib/concorsi";
import { EXPIRING_LONG_DAYS, EXPIRING_SHORT_DAYS, expiringItems, expiringMetadata } from "@/lib/concorsi-hubs";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const all = listConcorsi(await getJobs());
  return expiringMetadata(
    null,
    expiringItems(all, EXPIRING_LONG_DAYS).length,
    expiringItems(all, EXPIRING_SHORT_DAYS).length,
  );
}

export default async function ExpiringPage() {
  return <ExpiringView all={listConcorsi(await getJobs())} profession={null} />;
}
