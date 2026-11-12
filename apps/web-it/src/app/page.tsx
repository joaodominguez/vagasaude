import Link from "next/link";
import {
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { JobCard } from "@/components/job-card";
import { ItalyJobsMap } from "@/components/italy-jobs-map";
import { SearchForm } from "@/components/search-form";
import {
  categoryPath,
  isCategoryEligible,
  listCategoryChips,
} from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { professions } from "@/lib/jobs";
import { formatNewsDate, listArticles, newsCategoryLabel, newsPath } from "@/lib/news";
import { buildHomeMetadata } from "@/lib/seo";
import {
  listEligibleConcorsi,
  listConcorsi,
  concorsiPath,
  professionLower,
} from "@/lib/concorsi";

// Soft-expire allineato alla Data Cache delle offerte (ingestione ≤2 min).
export const revalidate = 120;

export async function generateMetadata() {
  const jobs = await getJobs();
  return buildHomeMetadata(jobs.length);
}

export default async function Home() {
  const jobs = await getJobs();
  const recentJobs = [...jobs]
    .sort((a, b) => {
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "it");
    })
    .slice(0, 6);
  const districtCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job.district || "Italia";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  // Tutte le landing di professione e di regione (link interni per Google).
  const categoryChips = listCategoryChips(jobs, Number.POSITIVE_INFINITY);
  const latestNews = listArticles().slice(0, 3);
  const concorsi = listConcorsi(jobs);
  const concorsoRefs = listEligibleConcorsi(concorsi).filter(
    (ref) => !ref.district,
  );
  const professionCategories = categoryChips.filter((c) => c.kind === "profession");
  const districtCategories = categoryChips.filter((c) => c.kind === "district");

  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="page-container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow">
                <BriefcaseMedical size={15} />
                Lavoro nella sanità, semplificato
              </span>
              <h1 className="hero-title">
                La tua prossima opportunità
                <br className="hidden sm:block" /> nella sanità inizia qui.
              </h1>
              <p className="hero-copy">
                Tutte le offerte di lavoro nella sanità in Italia in un unico posto.
              </p>
            </div>

            <div className="mx-auto mt-9 max-w-5xl">
              <SearchForm />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-xs font-semibold text-muted">
                  Ricerche popolari
                </span>
                {professions.slice(0, 5).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/offerte?professione=${encodeURIComponent(profession)}`;
                  return (
                    <Link prefetch={false} key={profession} href={href} className="filter-chip">
                      {profession}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="page-container py-14 sm:py-18">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <span className="section-kicker">Aggiornato ogni giorno</span>
              <h2 className="section-title">Offerte più recenti</h2>
            </div>
            <Link
              href="/offerte"
              className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
            >
              Vedi tutte le offerte <ArrowRight size={16} />
            </Link>
          </div>

          {recentJobs.length > 0 ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {recentJobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          ) : (
            <div className="content-card px-6 py-12 text-center">
              <h3 className="text-lg font-extrabold">
                Stiamo raccogliendo le prime offerte
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Al momento non ci sono offerte pubblicate. Crea un avviso e ti
                scriviamo appena arrivano le prime.
              </p>
              <Link className="button button-primary mt-6 inline-flex" href="/avvisi">
                Crea avviso
              </Link>
            </div>
          )}

          <Link
            href="/offerte"
            className="button button-secondary mt-6 w-full sm:hidden"
          >
            Vedi tutte le offerte
          </Link>
        </section>

        {concorsi.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="section-kicker">Lavoro pubblico</span>
                <h2 className="section-title">Concorsi aperti</h2>
                <p className="mt-2 text-sm text-muted">
                  {concorsi.length}{" "}
                  {concorsi.length === 1
                    ? "bando tra concorsi, avvisi pubblici, graduatorie e mobilità"
                    : "bandi tra concorsi, avvisi pubblici, graduatorie e mobilità"}
                  , con link alla fonte ufficiale.
                </p>
              </div>
              <Link
                href="/concorsi"
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Vedi tutti <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {concorsi.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            {concorsoRefs.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {concorsoRefs.map((ref) => (
                  <Link prefetch={false}
                    key={ref.path}
                    href={concorsiPath(ref.profession)}
                    className="filter-chip"
                  >
                    Concorsi di {professionLower(ref.profession ?? "")} ({ref.count})
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/concorsi"
              className="button button-secondary mt-6 w-full sm:hidden"
            >
              Vedi tutti i concorsi
            </Link>
          </section>
        )}

        {latestNews.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="section-kicker">Mercato del lavoro</span>
                <h2 className="section-title">Ultime notizie</h2>
              </div>
              <Link
                href="/notizie"
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Tutte le notizie <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              {latestNews.map((article) => (
                <article key={article.slug} className="content-card flex min-w-0 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="tag tag-primary">{newsCategoryLabel(article.category)}</span>
                    <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
                  </div>
                  <h3 className="mt-3 font-extrabold leading-snug">
                    <Link href={newsPath(article.slug)} className="hover:text-primary">
                      {article.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>
        )}

        {categoryChips.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <span className="section-kicker">Categorie</span>
            <h2 className="section-title">Esplora per professione e regione</h2>
            {professionCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Per professione
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {professionCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path} className="filter-chip">
                      {category.profession}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {districtCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Per regione
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {districtCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path} className="filter-chip">
                      {category.district}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {jobs.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="page-container py-14 sm:py-18">
            <div className="mb-8 max-w-2xl">
              <span className="section-kicker">Per zona</span>
              <h2 className="section-title">Offerte in Italia</h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
                Scopri dove ci sono più opportunità in questo momento e vai
                direttamente alla regione che ti interessa.
              </p>
            </div>
            <ItalyJobsMap counts={districtCounts} total={jobs.length} />
          </div>
        </section>
        )}

        <section id="chi-siamo" className="page-container py-14 sm:py-18">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BriefcaseMedical,
                title: "Tutto in un unico posto",
                copy: "Raccogliamo opportunità del settore pubblico, privato e accreditato.",
              },
              {
                icon: CheckCircle2,
                title: "Offerte aggiornate",
                copy: "Controlliamo le fonti con regolarità e rimuoviamo le offerte scadute.",
              },
              {
                icon: ShieldCheck,
                title: "Candidatura sicura",
                copy: "Ti portiamo sempre al sito ufficiale dell'ente o dell'azienda.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <article key={title} className="feature-card">
                <span className="feature-icon">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 font-extrabold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Partners />
      <Footer />
    </>
  );
}
