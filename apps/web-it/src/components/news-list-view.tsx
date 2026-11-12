import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import {
  formatNewsDate,
  listNewsCategories,
  newsCategoryLabel,
  newsCategoryPath,
  newsPath,
  type NewsArticle,
  type NewsCategory,
} from "@/lib/news";

export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className="content-card flex min-w-0 flex-col p-5 transition hover:border-primary">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="tag tag-primary">{newsCategoryLabel(article.category)}</span>
        <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
        {article.draft && <span className="tag tag-danger">Bozza</span>}
      </div>
      <h2 className="mt-3 text-lg font-extrabold leading-snug tracking-[-0.025em]">
        <Link href={newsPath(article.slug)} className="hover:text-primary">
          {article.title}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">{article.summary[0]}</p>
      <Link
        href={newsPath(article.slug)}
        className="mt-4 text-sm font-bold text-primary hover:underline"
        aria-label={`Leggi: ${article.title}`}
      >
        Leggi la notizia →
      </Link>
    </article>
  );
}

/** Hub ed elenchi per categoria (con paginazione nell'hub). */
export function NewsListView({
  title,
  intro,
  articles,
  activeCategory,
  breadcrumbs,
  pagination,
  emptyText,
}: {
  title: string;
  intro: string;
  articles: NewsArticle[];
  activeCategory: NewsCategory | null;
  breadcrumbs: BreadcrumbItem[];
  pagination?: { page: number; totalPages: number; pagePath: (page: number) => string };
  emptyText: string;
}) {
  const categories = listNewsCategories();
  return (
    <>
      <Header />
      <main className="page-container py-10 sm:py-14">
        <Breadcrumbs items={breadcrumbs} />
        <span className="section-kicker">Notizie</span>
        <h1 className="section-title">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">{intro}</p>

        {categories.length > 0 && (
          <nav aria-label="Categorie di notizie" className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/notizie"
              className={activeCategory ? "filter-chip" : "filter-chip filter-chip-active"}
            >
              Tutte
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                href={newsCategoryPath(category)}
                className={
                  category === activeCategory ? "filter-chip filter-chip-active" : "filter-chip"
                }
              >
                {newsCategoryLabel(category)}
              </Link>
            ))}
          </nav>
        )}

        {articles.length === 0 ? (
          <div className="content-card mt-8 p-6">
            <p className="text-sm leading-6 text-muted">{emptyText}</p>
            <Link href="/offerte" className="button button-primary mt-4">
              Vedi le offerte attive
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2">
            {articles.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <nav aria-label="Paginazione" className="mt-8 flex items-center justify-between gap-4 text-sm font-bold">
            {pagination.page > 1 ? (
              <Link
                href={pagination.pagePath(pagination.page - 1)}
                rel="prev"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ChevronLeft size={16} /> Più recenti
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Pagina {pagination.page} di {pagination.totalPages}
            </span>
            {pagination.page < pagination.totalPages ? (
              <Link
                href={pagination.pagePath(pagination.page + 1)}
                rel="next"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Meno recenti <ChevronRight size={16} />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>
      <Footer />
    </>
  );
}
