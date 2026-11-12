import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsListView } from "@/components/news-list-view";
import { SITE_NAME } from "@/lib/seo";
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

/** Esistono solo categorie con almeno 1 articolo pubblicato. */
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
    title: `${label}: notizie sul lavoro nella sanità`,
    description,
    alternates: { canonical: newsCategoryPath(category) },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${label} | Notizie ${SITE_NAME}`,
      description,
      url: newsCategoryPath(category),
      type: "website",
      locale: "it_IT",
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
        { label: "Home", href: "/" },
        { label: "Notizie", href: "/notizie" },
        { label },
      ]}
      emptyText="Non ci sono notizie in questa categoria."
    />
  );
}
