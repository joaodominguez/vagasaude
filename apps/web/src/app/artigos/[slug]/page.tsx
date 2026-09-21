import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { articles, getArticle } from "@/content/articles";
import {
  absoluteUrl,
  SITE_NAME,
  SITE_URL,
  truncateMeta,
} from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Artigo" };
  const title = article.title;
  const description = truncateMeta(article.summary, 160);
  const path = `/artigos/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      type: "article",
      siteName: SITE_NAME,
      locale: "pt_PT",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const url = absoluteUrl(`/artigos/${article.slug}`);
  const others = articles.filter((item) => item.slug !== article.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    inLanguage: "pt-PT",
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: url,
    isAccessibleForFree: true,
  };

  return (
    <>
      <Header />
      <main className="page-container py-14">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <article className="prose-page mx-auto max-w-3xl">
          <nav className="text-sm text-muted">
            <Link href="/artigos" className="hover:text-primary">
              Artigos
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{article.title}</span>
          </nav>

          <p className="section-kicker mt-5">
            {article.eyebrow} · {article.readMinutes} min
          </p>
          <h1>{article.title}</h1>
          <p>{article.lede}</p>

          <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-[0.92rem] leading-6 text-muted">
            Conteúdo informativo do VagaSaúde. Não substituímos aconselhamento
            de carreira nem os requisitos oficiais de cada anúncio — confirma
            sempre no site da entidade.
          </p>

          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.98rem] leading-7 text-muted">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={article.relatedJobsHref}
              className="button button-primary"
            >
              {article.relatedJobsLabel}
            </Link>
            <Link href="/alertas" className="button button-secondary">
              Criar alerta
            </Link>
          </div>

          <h2>Outros guias</h2>
          <ul className="mt-3 space-y-2">
            {others.map((item) => (
              <li key={item.slug}>
                <Link href={`/artigos/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-muted">
            Publicado{" "}
            <time dateTime={article.publishedAt}>{article.publishedAt}</time>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
