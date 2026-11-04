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
import { careerForProfession } from "@/lib/salary-tables";
import { absoluteUrl, SITE_NAME, SITE_URL, truncateMeta } from "@/lib/seo";

// Artigos são ficheiros; o bloco de vagas relacionadas precisa de dados frescos.
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
      locale: "pt_PT",
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

  // Vagas relacionadas: profissão e distrito (se ambos, prefere os dois; senão relaxa).
  const byPublished = [...allJobs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const inProf = (job: (typeof allJobs)[number]) =>
    article.professions.length === 0 || article.professions.includes(job.profession);
  const inDist = (job: (typeof allJobs)[number]) =>
    article.districts.length === 0 || article.districts.includes(job.district);
  const strict = byPublished.filter((job) => inProf(job) && inDist(job));
  const relaxed = byPublished.filter(inProf);
  const relatedJobs = (strict.length > 0 ? strict : relaxed.length > 0 ? relaxed : byPublished).slice(0, 6);

  // Só links para landings elegíveis (>= mínimo de vagas).
  const eligible = new Set(listEligibleCategories(allJobs).map((ref) => ref.path));
  const profession = article.professions[0] ?? null;
  const district = article.districts[0] ?? null;
  const jobsHref =
    [categoryPath(profession, district), categoryPath(profession, null), categoryPath(null, district)].find(
      (path) => path !== "/vagas" && eligible.has(path),
    ) ?? "/vagas";

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
  const authorIsOrg = /^reda[cç][aã]o|^vagasa[uú]de/i.test(article.author);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: article.title.slice(0, 110),
    description: article.description,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    inLanguage: "pt-PT",
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

  const what = article.professions.length > 0 ? article.professions.join(", ") : "saúde";

  return (
    <>
      <Header />
      <main className="page-container py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { label: "Início", href: "/" },
            { label: "Notícias", href: "/noticias" },
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
              {article.draft && <span className="tag tag-danger">Rascunho</span>}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.045em] sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 text-sm text-muted">
              Por {article.author} · Publicado em{" "}
              <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
              {article.updated && article.updated !== article.date && (
                <>
                  {" "}
                  · Actualizado em{" "}
                  <time dateTime={article.updated}>{formatNewsDate(article.updated)}</time>
                </>
              )}
            </p>
          </header>

          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt="" className="mt-6 w-full rounded-2xl border border-border" />
          )}

          <aside aria-labelledby="em-resumo" className="content-card mt-6 border-primary/40 bg-primary-soft p-5">
            <h2 id="em-resumo" className="text-sm font-extrabold uppercase tracking-wider text-primary">
              Em resumo
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6">
              {article.summary.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </aside>

          <div className="news-prose" dangerouslySetInnerHTML={{ __html: html }} />

          {article.sources.length > 0 && (
            <section className="mt-10" aria-labelledby="fontes">
              <h2 id="fontes" className="text-lg font-extrabold">
                Fontes
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

        <section className="mt-12" aria-labelledby="vagas-relacionadas">
          <h2 id="vagas-relacionadas" className="section-title">
            {article.professions.length > 0 && article.professions.length <= 2
              ? `Vagas de ${what.toLowerCase()} em aberto`
              : "Vagas relacionadas em aberto"}
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
              {jobsHref === "/vagas" ? "Ver todas as vagas" : "Ver todas as vagas desta área"} →
            </Link>
            {careers.map((career) => (
              <Link key={career.slug} href={`/salarios/${career.slug}`} className="text-primary hover:underline">
                Tabela salarial de {career.label} →
              </Link>
            ))}
          </div>
        </section>

        <section className="alert-card mt-10 max-w-xl">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Bell size={18} /> Recebe vagas por email
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Cria um alerta gratuito e recebe as novas vagas {profession ? `de ${profession.toLowerCase()}` : "de saúde"}
            {district ? ` em ${district}` : ""} assim que forem publicadas.
          </p>
          <div className="mt-4">
            <AlertForm compact defaultProfession={profession ?? ""} defaultDistrict={district ?? ""} />
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-12" aria-labelledby="mais-noticias">
            <h2 id="mais-noticias" className="section-title">
              Mais em {newsCategoryLabel(article.category)}
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
