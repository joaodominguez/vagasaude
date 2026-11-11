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
  const recentJobs = [...jobs]
    .sort((a, b) => {
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "es");
    })
    .slice(0, 6);
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
                Empleo sanitario, simplificado
              </span>
              <h1 className="hero-title">
                Tu próxima oportunidad
                <br className="hidden sm:block" /> en sanidad empieza aquí.
              </h1>
              <p className="hero-copy">
                Todas las ofertas de empleo sanitario de España en un solo sitio.
              </p>
            </div>

            <div className="mx-auto mt-9 max-w-5xl">
              <SearchForm />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-xs font-semibold text-muted">
                  Búsquedas populares
                </span>
                {professions.slice(0, 5).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/empleo?profesion=${encodeURIComponent(profession)}`;
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
              <span className="section-kicker">Actualizado a diario</span>
              <h2 className="section-title">Ofertas más recientes</h2>
            </div>
            <Link
              href="/empleo"
              className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
            >
              Ver todas las ofertas <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {recentJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>

          <Link
            href="/empleo"
            className="button button-secondary mt-6 w-full sm:hidden"
          >
            Ver todas las ofertas
          </Link>
        </section>

        {oposiciones.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
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
              <Link
                href="/oposiciones"
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Ver todas <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {oposiciones.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            {oposicionRefs.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {oposicionRefs.map((ref) => (
                  <Link prefetch={false}
                    key={ref.path}
                    href={oposicionesPath(ref.profession)}
                    className="filter-chip"
                  >
                    Oposiciones de {professionLower(ref.profession ?? "")} ({ref.count})
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/oposiciones"
              className="button button-secondary mt-6 w-full sm:hidden"
            >
              Ver todas las oposiciones
            </Link>
          </section>
        )}

        {latestNews.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="section-kicker">Mercado laboral</span>
                <h2 className="section-title">Últimas noticias</h2>
              </div>
              <Link
                href="/noticias"
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Todas las noticias <ArrowRight size={16} />
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
            <span className="section-kicker">Categorías</span>
            <h2 className="section-title">Explorar por profesión y comunidad</h2>
            {professionCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por profesión
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
                  Por comunidad
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

        <section className="border-y border-border bg-surface">
          <div className="page-container py-14 sm:py-18">
            <div className="mb-8 max-w-2xl">
              <span className="section-kicker">Por ubicación</span>
              <h2 className="section-title">Ofertas en España</h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
                Descubre dónde hay más oportunidades ahora mismo y salta
                directamente a la comunidad que te interesa.
              </p>
            </div>
            <SpainJobsMap counts={districtCounts} total={jobs.length} />
          </div>
        </section>

        <section id="sobre" className="page-container py-14 sm:py-18">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BriefcaseMedical,
                title: "Todo en un solo sitio",
                copy: "Reunimos oportunidades del sector público, privado y concertado.",
              },
              {
                icon: CheckCircle2,
                title: "Ofertas actualizadas",
                copy: "Revisamos las fuentes con regularidad y retiramos las ofertas caducadas.",
              },
              {
                icon: ShieldCheck,
                title: "Solicitud segura",
                copy: "Te llevamos siempre a la web oficial de la entidad.",
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
