import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsListView } from "@/components/news-list-view";
import {
  isNewsCategory,
  listArticlesByCategory,
  listNewsCategories,
  NEWS_CATEGORIES,
  newsCategoryLabel,
  newsCategoryPath,
} from "@/lib/news";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ category: string }>;

/** Só categorias com ≥1 artigo publicado existem. */
function resolve(raw: string) {
  return isNewsCategory(raw) && listNewsCategories().includes(raw) ? raw : null;
}

export function generateStaticParams() {
  return listNewsCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = resolve((await params).category);
  if (!category) return {};
  const label = newsCategoryLabel(category);
  const description = NEWS_CATEGORIES[category].description;
  return {
    title: `${label}: notícias de emprego em saúde`,
    description,
    alternates: { canonical: newsCategoryPath(category) },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${label} | Notícias VagaSaúde`,
      description,
      url: newsCategoryPath(category),
      type: "website",
      locale: "pt_PT",
    },
  };
}

export default async function NewsCategoryPage({ params }: { params: Params }) {
  const category = resolve((await params).category);
  if (!category) notFound();
  const label = newsCategoryLabel(category);
  return (
    <NewsListView
      title={label}
      intro={NEWS_CATEGORIES[category].description}
      articles={listArticlesByCategory(category)}
      activeCategory={category}
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "Notícias", href: "/noticias" },
        { label },
      ]}
      emptyText="Sem notícias nesta categoria."
    />
  );
}
