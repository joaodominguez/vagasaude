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

const TITLE = "Notícias de emprego e carreira na saúde";
const DESCRIPTION =
  "Mercado de trabalho, concursos públicos, salários e guias para profissionais de saúde no Brasil. Análises com dados das vagas do VagaSaúde.";

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
      title: `${TITLE} | VagaSaúde`,
      description: DESCRIPTION,
      url: "/noticias",
      type: "website",
      locale: "pt_BR",
    },
  };
}

export default function NewsHubPage() {
  const all = listArticles();
  return (
    <NewsListView
      title={TITLE}
      intro="Relatórios do mercado de trabalho, concursos, processos seletivos, salários e guias práticos para quem trabalha — ou quer trabalhar — na saúde no Brasil."
      articles={all.slice(0, NEWS_PAGE_SIZE)}
      activeCategory={null}
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Notícias" }]}
      pagination={{ page: 1, totalPages: newsTotalPages(all.length), pagePath: newsPagePath }}
      emptyText="Ainda não há notícias publicadas. Entretanto, explore as vagas de saúde mais recentes ou crie um alerta."
    />
  );
}
