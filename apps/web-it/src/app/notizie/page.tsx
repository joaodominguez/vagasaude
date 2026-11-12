import type { Metadata } from "next";
import { NewsListView } from "@/components/news-list-view";
import { SITE_NAME } from "@/lib/seo";
import {
  listArticles,
  newsPagePath,
  NEWS_PAGE_SIZE,
  newsTotalPages,
} from "@/lib/news";

export const dynamic = "force-static";
export const revalidate = 3600;

const TITLE = "Notizie su lavoro e carriere nella sanità";
const DESCRIPTION =
  "Mercato del lavoro, concorsi, stipendi e guide per i professionisti sanitari in Italia. Analisi con i dati delle offerte di Offerte Sanità.";

export function generateMetadata(): Metadata {
  const hasArticles = listArticles().length > 0;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: "/notizie",
      types: { "application/rss+xml": "/notizie/rss.xml" },
    },
    robots: hasArticles ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${TITLE} | ${SITE_NAME}`,
      description: DESCRIPTION,
      url: "/notizie",
      type: "website",
      locale: "it_IT",
    },
  };
}

export default function NewsHubPage() {
  const all = listArticles();
  return (
    <NewsListView
      title={TITLE}
      intro="Report sul mercato del lavoro, concorsi, stipendi e guide pratiche per chi lavora, o vuole lavorare, nella sanità in Italia."
      articles={all.slice(0, NEWS_PAGE_SIZE)}
      activeCategory={null}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Notizie" }]}
      pagination={{ page: 1, totalPages: newsTotalPages(all.length), pagePath: newsPagePath }}
      emptyText="Non ci sono ancora notizie pubblicate. Nel frattempo, esplora le offerte sanitarie più recenti o crea un avviso."
    />
  );
}
