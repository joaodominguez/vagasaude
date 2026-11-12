import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsListView } from "@/components/news-list-view";
import {
  listArticles,
  newsPagePath,
  NEWS_PAGE_SIZE,
  newsTotalPages,
} from "@/lib/news";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ page: string }>;

function resolvePage(raw: string) {
  if (!/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  const total = newsTotalPages(listArticles().length);
  return page >= 2 && page <= total ? page : null;
}

export function generateStaticParams() {
  const total = newsTotalPages(listArticles().length);
  return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ page: String(i + 2) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = resolvePage((await params).page);
  if (!page) return {};
  return {
    title: `Notizie su lavoro e carriere nella sanità — pagina ${page}`,
    alternates: { canonical: newsPagePath(page) },
    robots: { index: true, follow: true },
  };
}

export default async function NewsPagedPage({ params }: { params: Params }) {
  const page = resolvePage((await params).page);
  if (!page) notFound();
  const all = listArticles();
  return (
    <NewsListView
      title="Notizie su lavoro e carriere nella sanità"
      intro="Mercato del lavoro, concorsi, stipendi e guide per i professionisti sanitari in Italia."
      articles={all.slice((page - 1) * NEWS_PAGE_SIZE, page * NEWS_PAGE_SIZE)}
      activeCategory={null}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Notizie", href: "/notizie" },
        { label: `Pagina ${page}` },
      ]}
      pagination={{ page, totalPages: newsTotalPages(all.length), pagePath: newsPagePath }}
      emptyText="Non ci sono notizie in questa pagina."
    />
  );
}
