import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { NewsCard } from "@/components/news-list-view";
import { categoryPath, listEligibleCategories } from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import {
  formatNewsDate,
  getArticle,
  listArticles,
  newsCategoryLabel,
  newsCategoryPath,
  newsPath,
  relatedArticles,
  renderArticleHtml,
} from "@/lib/news";
import { enLugar } from "@/lib/es-locative";
import { careerForProfession } from "@/lib/salary-tables";
import { absoluteUrl, SITE_NAME, SITE_URL, truncateMeta } from "@/lib/seo";

// Los artículos son archivos; el bloque de ofertas relacionadas necesita datos frescos.
export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return listArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return {};
  const url = newsPath(article.slug);
  const description = truncateMeta(article.description, 160);
  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    robots: article.draft ? { index: false, follow: false } : { index: true, follow: true },
    authors: [{ name: article.author }],
    openGraph: {
      title: article.title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      locale: "es_ES",
      publishedTime: article.date,
      modifiedTime: article.updated ?? article.date,
      authors: [article.author],
      section: newsCategoryLabel(article.category),
      ...(article.image ? { images: [article.image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      ...(article.image ? { images: [article.image] } : {}),
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const article = getArticle((await params).slug);
  if (!article) notFound();

  const [html, allJobs] = await Promise.all([renderArticleHtml(article.body), getJobs()]);

  // Ofertas relacionadas: profesión y comunidad (si hay ambas, prefiere las dos; si no, relaja).
  const byPublished = [...allJobs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const inProf = (job: (typeof allJobs)[number]) =>
    article.professions.length === 0 || article.professions.includes(job.profession);
  const inDist = (job: (typeof allJobs)[number]) =>
    article.districts.length === 0 || article.districts.includes(job.district);
  const strict = byPublished.filter((job) => inProf(job) && inDist(job));
  const relaxed = byPublished.filter(inProf);
  const relatedJobs = (strict.length > 0 ? strict : relaxed.length > 0 ? relaxed : byPublished).slice(0, 6);

  // Solo enlaces a landings elegibles (>= mínimo de ofertas).
  const eligible = new Set(listEligibleCategories(allJobs).map((ref) => ref.path));
  const profession = article.professions[0] ?? null;
  const district = article.districts[0] ?? null;
  const jobsHref =
    [categoryPath(profession, district), categoryPath(profession, null), categoryPath(null, district)].find(
      (path) => path !== "/empleo" && eligible.has(path),
    ) ?? "/empleo";

  const careers = [
    ...new Map(
      article.professions
        .map((p) => careerForProfession(p))
        .filter((c): c is NonNullable<typeof c> => c != null)
        .map((c) => [c.slug, c]),
    ).values(),
  ];
  const related = relatedArticles(article);
  const url = absoluteUrl(newsPath(article.slug));
  const authorIsOrg = /^redacci[oó]n|^vacantessalud/i.test(article.author);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: article.title.slice(0, 110),
    description: article.description,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    inLanguage: "es-ES",
    articleSection: newsCategoryLabel(article.category),
    author: { "@type": authorIsOrg ? "Organization" : "Person", name: article.author, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") },
    },
    ...(article.image ? { image: [absoluteUrl(article.image)] } : {}),
  };

  const what = article.professions.length > 0 ? article.professions.join(", ") : "sanitarias";

  return (
    <>
      <Header />
      <main className="page-container py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Noticias", href: "/noticias" },
            { label: newsCategoryLabel(article.category), href: newsCategoryPath(article.category) },
            { label: article.title },
          ]}
        />

        <article className="news-article">
          <header>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href={newsCategoryPath(article.category)} className="tag tag-primary">
                {newsCategoryLabel(article.category)}
              </Link>
              {article.draft && <span className="tag tag-danger">Borrador</span>}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.045em] sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 text-sm text-muted">
              Por {article.author} · Publicado el{" "}
              <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
              {article.updated && article.updated !== article.date && (
                <>
                  {" "}
                  · Actualizado el{" "}
                  <time dateTime={article.updated}>{formatNewsDate(article.updated)}</time>
                </>
              )}
            </p>
          </header>

          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt="" className="mt-6 w-full rounded-2xl border border-border" />
          )}

          <aside aria-labelledby="en-resumen" className="content-card mt-6 border-primary/40 bg-primary-soft p-5">
            <h2 id="en-resumen" className="text-sm font-extrabold uppercase tracking-wider text-primary">
              En resumen
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6">
              {article.summary.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </aside>

          <div className="news-prose" dangerouslySetInnerHTML={{ __html: html }} />

          {article.sources.length > 0 && (
            <section className="mt-10" aria-labelledby="fuentes">
              <h2 id="fuentes" className="text-lg font-extrabold">
                Fuentes
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                {article.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-primary hover:underline"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <section className="mt-12" aria-labelledby="ofertas-relacionadas">
          <h2 id="ofertas-relacionadas" className="section-title">
            {article.professions.length > 0 && article.professions.length <= 2
              ? `Ofertas de ${what.toLowerCase()} abiertas`
              : "Ofertas relacionadas abiertas"}
          </h2>
          {relatedJobs.length > 0 && (
            <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2">
              {relatedJobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
            <Link href={jobsHref} className="text-primary hover:underline">
              {jobsHref === "/empleo" ? "Ver todas las ofertas" : "Ver todas las ofertas de esta área"} →
            </Link>
            {careers.map((career) => (
              <Link key={career.slug} href={`/salarios/${career.slug}`} className="text-primary hover:underline">
                Tablas salariales de {career.label} →
              </Link>
            ))}
          </div>
        </section>

        <section className="alert-card mt-10 max-w-xl">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Bell size={18} /> Recibe ofertas por email
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Crea una alerta gratuita y recibe las nuevas ofertas {profession ? `de ${profession.toLowerCase()}` : "sanitarias"}
            {district ? ` ${enLugar(district)}` : ""} en cuanto se publiquen.
          </p>
          <div className="mt-4">
            <AlertForm compact defaultProfession={profession ?? ""} defaultDistrict={district ?? ""} />
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-12" aria-labelledby="mas-noticias">
            <h2 id="mas-noticias" className="section-title">
              Más en {newsCategoryLabel(article.category)}
            </h2>
            <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <NewsCard key={item.slug} article={item} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
