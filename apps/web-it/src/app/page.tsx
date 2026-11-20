import Link from "next/link";
import { ArrowRight, BriefcaseMedical } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { AlertForm } from "@/components/alert-form";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { JobIcon } from "@/components/profession-icon";
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
import { isSitemapJob } from "@/lib/indexable";
import { RECENT_PATH, entryTime, listRecentJobs, recentLinkLabel } from "@/lib/recent-jobs";
import { buildHomeMetadata } from "@/lib/seo";
import { freshnessLabel, homePaths, listHomeAreas } from "@/lib/home-sections";
import { employerPath } from "@/lib/employers";
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
  // Solo offerte del jobs.xml (indicizzabili), le più recenti prima: link diretti per Googlebot.
  const recentJobs = jobs
    .filter((job) => isSitemapJob(job))
    .sort((a, b) => {
      const byEntry = entryTime(b) - entryTime(a);
      if (byEntry !== 0) return byEntry;
      return a.title.localeCompare(b.title, "it");
    })
    .slice(0, 12);
  const todaySet = listRecentJobs(jobs);
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
  const areas = listHomeAreas(jobs);
  const { publicPath, privatePath } = homePaths(jobs);
  const sourceCount = new Set(jobs.map((job) => job.source).filter(Boolean)).size;
  const freshness = freshnessLabel(jobs);
  const nf = new Intl.NumberFormat("it-IT");

  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="page-container relative z-10">
            <div className="mx-auto max-w-4xl text-center">
              <span className="eyebrow">
                <BriefcaseMedical size={15} />
                Lavoro nella sanità, semplificato
              </span>
              <h1 className="hero-title">
                La tua prossima opportunità
                <br className="hidden sm:block" /> nella <b>sanità</b> inizia qui.
              </h1>
              <p className="hero-copy">
                Tutte le offerte di lavoro nella sanità in Italia in un unico posto.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-[52rem]">
              <SearchForm />
              {jobs.length > 0 && (
                <p className="trust-line" aria-label="Il sito in numeri">
                  <span>
                    <b>{nf.format(jobs.length)}</b> offerte attive
                  </span>
                  {sourceCount > 1 && (
                    <span>
                      <b>{sourceCount}</b> fonti, dai concorsi pubblici alle cliniche private
                    </span>
                  )}
                  {freshness && <span className="live-dot">{freshness}</span>}
                </p>
              )}
              <nav className="popular-links" aria-label="Ricerche popolari">
                {professions.slice(0, 6).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/offerte?professione=${encodeURIComponent(profession)}`;
                  return (
                    <Link prefetch={false} key={profession} href={href}>
                      {profession}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </section>

        {areas.length > 0 && (
          <section className="page-container pt-14 sm:pt-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Per area</span>
                <h2 className="section-title">Che area cerchi?</h2>
              </div>
              <Link href="/offerte" className="home-more">
                Tutte le professioni <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="area-grid">
              {areas.map((area) => (
                <Link key={area.key} href={area.href} className="area-card" prefetch={false}>
                  <JobIcon profession={area.iconProfession} />
                  <span className="min-w-0">
                    <strong>{area.label}</strong>
                    <span className="area-count">
                      {nf.format(area.count)} {area.count === 1 ? "offerta" : "offerte"}
                    </span>
                    <span className="area-desc">{area.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="page-container py-14 sm:py-16">
          <div className="home-head">
            <div>
              <span className="section-kicker">Aggiornato ogni giorno</span>
              <h2 className="section-title">Offerte più recenti</h2>
            </div>
            <Link href={RECENT_PATH} className="home-more">
              {recentLinkLabel(todaySet)} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {recentJobs.length > 0 ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
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
          <p className="mt-5 text-sm">
            <Link href="/offerte" className="home-more">
              Vedi tutte le {nf.format(jobs.length)} offerte <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </section>

        <section id="avvisi" className="page-container pb-14 sm:pb-16">
          <div className="alert-band">
            <div>
              <span className="alert-band-kicker">Avvisi gratuiti</span>
              <h2>Ricevi le nuove offerte prima di tutti</h2>
              <p>
                Scegli professione e regione. Ti scriviamo al massimo 2 volte al giorno e puoi
                annullare con un clic.
              </p>
              <SocialAlertLinks onDark className="mt-3" />
            </div>
            <AlertForm band />
          </div>
        </section>

        {jobs.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Per regione</span>
                <h2 className="section-title">Offerte in Italia</h2>
              </div>
              <Link href="/offerte" className="home-more">
                Tutte le regioni <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ItalyJobsMap counts={districtCounts} total={jobs.length} />
          </section>
        )}

        {jobs.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Pubblico o privato</span>
                <h2 className="section-title">Due strade nella sanità</h2>
              </div>
            </div>
            <div className="paths-grid">
              <div className="path-card">
                <h3>
                  SSN e settore pubblico <span>{nf.format(publicPath.count)} offerte</span>
                </h3>
                <p>Concorsi, avvisi e mobilità di ASL, ASST, ospedali e IRCCS pubblici.</p>
                {publicPath.employers.length > 0 && (
                  <div className="mini-list">
                    {publicPath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/concorsi" className="home-more">
                  Vedi i concorsi aperti <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="path-card">
                <h3>
                  Privato e accreditato <span>{nf.format(privatePath.count)} offerte</span>
                </h3>
                <p>Ospedali e cliniche private, RSA, laboratori, cliniche veterinarie e strutture accreditate.</p>
                {privatePath.employers.length > 0 && (
                  <div className="mini-list">
                    {privatePath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/aziende" className="home-more">
                  Vedi tutte le aziende <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {concorsi.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
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
              <Link href="/concorsi" className="home-more">
                Vedi tutti i concorsi <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {concorsi.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            {concorsoRefs.length > 0 && (
              <div className="explore-links mt-5">
                <Link prefetch={false} href="/concorsi/in-scadenza">
                  Concorsi in scadenza
                </Link>
                <Link prefetch={false} href="/concorsi-infermieri-2026">
                  Concorsi infermieri 2026
                </Link>
                <Link prefetch={false} href="/concorsi-oss-2026">
                  Concorsi OSS 2026
                </Link>
                {concorsoRefs.map((ref) => (
                  <Link prefetch={false} key={ref.path} href={concorsiPath(ref.profession)}>
                    Concorsi di {professionLower(ref.profession ?? "")} ({ref.count})
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {latestNews.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Mercato del lavoro</span>
                <h2 className="section-title">Ultime notizie</h2>
              </div>
              <Link href="/notizie" className="home-more">
                Tutte le notizie <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="news-grid">
              {latestNews.map((article) => (
                <Link key={article.slug} href={newsPath(article.slug)} prefetch={false}>
                  <small>
                    {newsCategoryLabel(article.category)} ·{" "}
                    <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
                  </small>
                  <strong>{article.title}</strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        {categoryChips.length > 0 && (
          <section id="chi-siamo" className="page-container pb-14 sm:pb-16">
            <span className="section-kicker">Categorie</span>
            <h2 className="section-title">Esplora per professione e regione</h2>
            {professionCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Per professione
                </h3>
                <div className="explore-links">
                  {professionCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path}>
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
                <div className="explore-links">
                  {districtCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path}>
                      {category.district}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <Partners />
      <Footer />
    </>
  );
}
