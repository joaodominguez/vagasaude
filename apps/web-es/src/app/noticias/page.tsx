import type { Metadata } from "next";
import { NewsListView } from "@/components/news-list-view";
import {
  listArticles,
  newsPagePath,
  NEWS_PAGE_SIZE,
  newsTotalPages,
} from "@/lib/news";

export const dynamic = "force-static";
export const revalidate = 3600;

const TITLE = "Noticias de empleo y carreras sanitarias";
const DESCRIPTION =
  "Mercado laboral, oposiciones, salarios y guías para profesionales sanitarios en España. Análisis con datos de las ofertas de VacantesSalud.";

export function generateMetadata(): Metadata {
  const hasArticles = listArticles().length > 0;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: "/noticias",
      types: { "application/rss+xml": "/noticias/rss.xml" },
    },
    robots: hasArticles ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${TITLE} | VacantesSalud`,
      description: DESCRIPTION,
      url: "/noticias",
      type: "website",
      locale: "es_ES",
    },
  };
}

export default function NewsHubPage() {
  const all = listArticles();
  return (
    <NewsListView
      title={TITLE}
      intro="Informes del mercado laboral, oposiciones, salarios y guías prácticas para quien trabaja, o quiere trabajar, en la sanidad en España."
      articles={all.slice(0, NEWS_PAGE_SIZE)}
      activeCategory={null}
      breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Noticias" }]}
      pagination={{ page: 1, totalPages: newsTotalPages(all.length), pagePath: newsPagePath }}
      emptyText="Todavía no hay noticias publicadas. Mientras tanto, explora las ofertas sanitarias más recientes o crea una alerta."
    />
  );
}
