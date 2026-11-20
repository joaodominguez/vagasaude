import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { RegionView } from "@/components/zone-carenti-view";
import { SITE_NAME } from "@/lib/seo";
import { REGIONI, TIPO_SHORT, getRegione, int, regionTotals, zcRegionPath } from "@/lib/zone-carenti";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

type Params = Promise<{ regione: string }>;

export function generateStaticParams() {
  return REGIONI.map((r) => ({ regione: r.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = getRegione((await params).regione);
  if (!r) return {};
  const { total, byTipo } = regionTotals(r);
  const path = zcRegionPath(r.slug);
  const title = `Zone carenti medicina generale ${r.nome} 2026`;
  const parts = [...byTipo.entries()].map(([t, n]) => `${TIPO_SHORT[t].toLowerCase()} ${int(n)}`).join(", ");
  const description = `Ambiti carenti ${r.nome} 2026: ${int(total)} posti (${parts}). Medicina generale, continuità assistenziale (ruolo unico), pediatria e 118 per ASL, con scadenze e atto ufficiale.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
  };
}

export default async function RegionPage({ params }: { params: Params }) {
  const r = getRegione((await params).regione);
  if (!r) notFound();
  return (
    <>
      <Header />
      <RegionView regione={r} />
      <Footer />
    </>
  );
}
