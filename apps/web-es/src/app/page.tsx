import Link from "next/link";
import { ArrowRight, BriefcaseMedical } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { AlertForm } from "@/components/alert-form";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { JobIcon } from "@/components/profession-icon";
import { JobCard } from "@/components/job-card";
import { SpainJobsMap } from "@/components/spain-jobs-map";
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
import { isSitemapJob } from "@/lib/sitemap-jobs";
import { entryTime, listRecentJobs, RECENT_PATH } from "@/lib/recent-jobs";
import { freshnessLabel, homePaths, listHomeAreas } from "@/lib/home-sections";
import { employerPath } from "@/lib/employers";
import {
  listEligibleOposiciones,
  listOposiciones,
  oposicionesPath,
  professionLower,
} from "@/lib/oposiciones";

// Soft-expire alineado con el Data Cache de jobs (ingesta ≤2 min).
export const revalidate = 120;

export async function generateMetadata() {
  const jobs = await getJobs();
  return buildHomeMetadata(jobs.length);
}

export default async function Home() {
  const jobs = await getJobs();
  // Solo ofertas indexables (las del jobs.xml), más recientes primero: enlaces directos para Googlebot.
  const recentJobs = [...jobs]
    .filter((job) => isSitemapJob(job))
    .sort((a, b) => {
      const byEntry = entryTime(b) - entryTime(a);
      if (byEntry !== 0) return byEntry;
      return a.title.localeCompare(b.title, "es");
    })
    .slice(0, 12);
  const todaySet = listRecentJobs(jobs);
  const districtCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job.district || "España";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  // Todas las landings de profesión y de comunidad (enlaces internos para Google).
  const categoryChips = listCategoryChips(jobs, Number.POSITIVE_INFINITY);
  const latestNews = listArticles().slice(0, 3);
  const oposiciones = listOposiciones(jobs);
  const oposicionRefs = listEligibleOposiciones(oposiciones).filter(
    (ref) => !ref.district,
  );
  const professionCategoríass = categoryChips.filter((c) => c.kind === "profession");
  const districtCategoríass = categoryChips.filter((c) => c.kind === "district");
  const areas = listHomeAreas(jobs);
  const { publicPath, privatePath } = homePaths(jobs);
  const sourceCount = new Set(jobs.map((job) => job.source).filter(Boolean)).size;
  const freshness = freshnessLabel(jobs);
  const nf = new Intl.NumberFormat("es-ES");

  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="page-container relative z-10">
            <div className="mx-auto max-w-4xl text-center">
              <span className="eyebrow">
                <BriefcaseMedical size={15} />
                Empleo sanitario, simplificado
              </span>
              <h1 className="hero-title">
                Tu próxima oportunidad
                <br className="hidden sm:block" /> en <b>sanidad</b> empieza aquí.
              </h1>
              <p className="hero-copy">
                Todas las ofertas de empleo sanitario de España en un solo sitio.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-[52rem]">
              <SearchForm />
              {jobs.length > 0 && (
                <p className="trust-line" aria-label="El sitio en cifras">
                  <span>
                    <b>{nf.format(jobs.length)}</b> ofertas activas
                  </span>
                  {sourceCount > 1 && (
                    <span>
                      <b>{sourceCount}</b> fuentes, de las oposiciones públicas a las residencias privadas
                    </span>
                  )}
                  {freshness && <span className="live-dot">{freshness}</span>}
                </p>
              )}
              <nav className="popular-links" aria-label="Búsquedas populares">
                {professions.slice(0, 6).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/empleo?profesion=${encodeURIComponent(profession)}`;
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
                <span className="section-kicker">Por área</span>
                <h2 className="section-title">¿Qué área buscas?</h2>
              </div>
              <Link href="/empleo" className="home-more">
                Todas las profesiones <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="area-grid">
              {areas.map((area) => (
                <Link key={area.key} href={area.href} className="area-card" prefetch={false}>
                  <JobIcon profession={area.iconProfession} />
                  <span className="min-w-0">
                    <strong>{area.label}</strong>
                    <span className="area-count">
                      {nf.format(area.count)} {area.count === 1 ? "oferta" : "ofertas"}
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
              <span className="section-kicker">Actualizado a diario</span>
              <h2 className="section-title">Ofertas más recientes</h2>
            </div>
            <Link href={RECENT_PATH} className="home-more">
              {todaySet.hours <= 48
                ? `Ver las ${nf.format(todaySet.jobs.length)} ofertas de hoy`
                : `Ver las ${nf.format(todaySet.jobs.length)} ofertas más recientes`}{" "}
              <ArrowRight size={16} aria-hidden="true" />
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
                Estamos reuniendo las primeras ofertas
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Ahora mismo no hay ofertas publicadas. Crea una alerta y te
                escribimos en cuanto lleguen las primeras.
              </p>
              <Link className="button button-primary mt-6 inline-flex" href="/alertas">
                Crear alerta
              </Link>
            </div>
          )}
          {recentJobs.length > 0 && (
            <p className="mt-5 text-sm">
              <Link href="/empleo" className="home-more">
                Ver las {nf.format(jobs.length)} ofertas <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          )}
        </section>

        <section id="alertas" className="page-container pb-14 sm:pb-16">
          <div className="alert-band">
            <div>
              <span className="alert-band-kicker">Alertas gratuitas</span>
              <h2>Recibe las ofertas nuevas antes que nadie</h2>
              <p>
                Elige profesión y comunidad. Te escribimos como máximo 2 veces al día y puedes
                darte de baja con un clic.
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
                <span className="section-kicker">Por comunidad</span>
                <h2 className="section-title">Ofertas en España</h2>
              </div>
              <Link href="/empleo" className="home-more">
                Todas las comunidades <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <SpainJobsMap counts={districtCounts} total={jobs.length} />
          </section>
        )}

        {jobs.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Público o privado</span>
                <h2 className="section-title">Dos caminos en la sanidad</h2>
              </div>
            </div>
            <div className="paths-grid">
              <div className="path-card">
                <h3>
                  SNS y sector público <span>{nf.format(publicPath.count)} ofertas</span>
                </h3>
                <p>Oposiciones, bolsas de empleo y traslados de los servicios de salud y hospitales públicos.</p>
                {publicPath.employers.length > 0 && (
                  <div className="mini-list">
                    {publicPath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/oposiciones" className="home-more">
                  Ver oposiciones abiertas <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="path-card">
                <h3>
                  Privado y concertado <span>{nf.format(privatePath.count)} ofertas</span>
                </h3>
                <p>Hospitales y clínicas privadas, residencias, laboratorios, clínicas veterinarias y centros concertados.</p>
                {privatePath.employers.length > 0 && (
                  <div className="mini-list">
                    {privatePath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/empresas" className="home-more">
                  Ver todas las empresas <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {oposiciones.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Empleo público</span>
                <h2 className="section-title">Oposiciones abiertas</h2>
                <p className="mt-2 text-sm text-muted">
                  {oposiciones.length}{" "}
                  {oposiciones.length === 1
                    ? "convocatoria de oposición, OPE o bolsa de empleo"
                    : "convocatorias de oposiciones, OPE y bolsas de empleo"}
                  , con enlace a las bases oficiales.
                </p>
              </div>
              <Link href="/oposiciones" className="home-more">
                Ver todas las oposiciones <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {oposiciones.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            {oposicionRefs.length > 0 && (
              <div className="explore-links mt-5">
                {oposicionRefs.map((ref) => (
                  <Link prefetch={false} key={ref.path} href={oposicionesPath(ref.profession)}>
                    Oposiciones de {professionLower(ref.profession ?? "")} ({ref.count})
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
                <span className="section-kicker">Mercado laboral</span>
                <h2 className="section-title">Últimas noticias</h2>
              </div>
              <Link href="/noticias" className="home-more">
                Todas las noticias <ArrowRight size={16} aria-hidden="true" />
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
          <section id="sobre" className="page-container pb-14 sm:pb-16">
            <span className="section-kicker">Categorías</span>
            <h2 className="section-title">Explorar por profesión y comunidad</h2>
            {professionCategoríass.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por profesión
                </h3>
                <div className="explore-links">
                  {professionCategoríass.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path}>
                      {category.profession}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {districtCategoríass.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por comunidad
                </h3>
                <div className="explore-links">
                  {districtCategoríass.map((category) => (
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
