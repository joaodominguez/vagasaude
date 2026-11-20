import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExpiringView } from "@/components/expiring-view";
import { filterConcorsi, listConcorsi, resolveConcorsoSegments } from "@/lib/concorsi";
import {
  EXPIRING_LONG_DAYS,
  EXPIRING_MIN_PROFESSION,
  EXPIRING_SHORT_DAYS,
  expiringItems,
  expiringMetadata,
} from "@/lib/concorsi-hubs";
import { getJobs } from "@/lib/jobs-data";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ profession: string }>;

async function load(params: Params) {
  const resolved = resolveConcorsoSegments((await params).profession);
  if (!resolved?.profession) return null;
  const all = listConcorsi(await getJobs());
  const scope = filterConcorsi(all, resolved.profession, null);
  const within14 = expiringItems(scope, EXPIRING_LONG_DAYS);
  if (within14.length < EXPIRING_MIN_PROFESSION) return null;
  return { all, profession: resolved.profession, within14, within7: expiringItems(scope, EXPIRING_SHORT_DAYS) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Concorsi non trovati", robots: { index: false } };
  return expiringMetadata(data.profession, data.within14.length, data.within7.length);
}

/** Solo con almeno 3 bandi in scadenza entro 14 giorni; altrimenti 404. */
export default async function ExpiringProfessionPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  return <ExpiringView all={data.all} profession={data.profession} />;
}
