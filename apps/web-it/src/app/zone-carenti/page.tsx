import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { HubView } from "@/components/zone-carenti-view";
import { SITE_NAME } from "@/lib/seo";
import { REGIONI, ZC_HUB_PATH, int, regionTotals } from "@/lib/zone-carenti";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const total = REGIONI.reduce((s, r) => s + regionTotals(r).total, 0);
  const title = "Zone carenti 2026: incarichi vacanti medici di famiglia e pediatri per regione";
  const description = `Ambiti carenti e incarichi vacanti 2026 di medicina generale, pediatria di libera scelta e 118: ${int(total)} posti in ${REGIONI.map((r) => r.nome).join(", ")}, con scadenze e link agli atti ufficiali.`;
  return {
    title,
    description,
    alternates: { canonical: ZC_HUB_PATH },
    openGraph: { title, description, url: ZC_HUB_PATH, type: "website", siteName: SITE_NAME, locale: "it_IT" },
  };
}

export default function ZoneCarentiPage() {
  return (
    <>
      <Header />
      <HubView />
      <Footer />
    </>
  );
}
