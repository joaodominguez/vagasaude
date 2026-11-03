import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { applyTrackingProps } from "@/lib/analytics";
import { CategoryPageView } from "@/components/category-page-view";
import { FavoriteButton } from "@/components/favorite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JobDescription } from "@/components/job-description";
import { SalaryInsight } from "@/components/salary-insight";
import { ShareButtons } from "@/components/share-buttons";
import {
  buildCategoryMetadata,
  categoryPath,
  filterJobsForCategory,
  isCategoryEligible,
  listEligibleCategories,
  resolveCategoryFromSegments,
} from "@/lib/categories";
import type { Job } from "@/lib/jobs";
import { getJob, getJobs } from "@/lib/jobs-data";
import { buildJobMetadata, buildJobPostingJsonLd, jobUrl } from "@/lib/seo";
import { enLugar } from "@/lib/es-locative";

// force-static + revalidate: HTML ISR on-demand (revalidate sozinho não
// chega se a árvore for tratada como dinâmica por I/O).
export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const allJobs = await getJobs();
  const category = resolveCategoryFromSegments(slug);
  if (
    category &&
    isCategoryEligible(allJobs, category.profession, category.district)
  ) {
    const jobs = filterJobsForCategory(
      allJobs,
      category.profession,
      category.district,
    );
    return buildCategoryMetadata(category, jobs.length, jobs);
  }

  const found = await getJob(slug);
  if (!found) return { title: "Oferta no encontrada", robots: { index: false } };
  return buildJobMetadata(found.job, {
    expired: found.expired,
    canonicalSlug: found.canonicalSlug,
  });
}

export default async function EmpleoSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const allJobs = await getJobs();
  const category = resolveCategoryFromSegments(slug);

  if (
    category &&
    isCategoryEligible(allJobs, category.profession, category.district)
  ) {
    const jobs = filterJobsForCategory(
      allJobs,
      category.profession,
      category.district,
    );
    return (
      <CategoryPageView
        category={category}
        jobs={jobs}
        allCategoryRefs={listEligibleCategories(allJobs)}
      />
    );
  }

  // Slug reservado a categoría sin inventario suficiente → listado filtrado.
  if (category) {
    const paramsQs = new URLSearchParams();
    if (category.profession) paramsQs.set("profesion", category.profession);
    if (category.district) paramsQs.set("comunidad", category.district);
    redirect(`/empleo?${paramsQs.toString()}`);
  }

  const found = await getJob(slug);
  if (!found) notFound();

  if (found.expired) {
    return <ExpiredJobView job={found.job} allJobs={allJobs} />;
  }

  return <ActiveJobView
      job={found.job}
      allJobs={allJobs}
      canonicalSlug={found.canonicalSlug}
    />;
}

function scoreRelated(candidate: Job, target: Job): number {
  let score = 0;
  if (candidate.profession === target.profession) score += 5;
  if (candidate.district === target.district) score += 3;
  if (candidate.sector === target.sector) score += 2;
  const tWords = new Set(
    target.title
      .toLocaleLowerCase("es")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  for (const w of candidate.title
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .filter((w) => w.length > 3)) {
    if (tWords.has(w)) score += 1;
  }
  if (candidate.company === target.company) score += 1;
  return score;
}

function ActiveJobView({
  job,
  allJobs,
  canonicalSlug,
}: {
  job: Job;
  allJobs: Job[];
  canonicalSlug?: string;
}) {
  const related = allJobs
    .filter(
      (item) =>
        item.slug !== job.slug &&
        (item.profession === job.profession || item.district === job.district),
    )
    .sort((a, b) => scoreRelated(b, job) - scoreRelated(a, job))
    .slice(0, 6);

  // Republicación de otra oferta: sin JobPosting (solo la oferta principal).
  const jsonLd = canonicalSlug ? null : buildJobPostingJsonLd(job);
  const shareUrl = jobUrl(job.slug);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);

  return (
    <>
      <Header />
      <main className="pb-24 md:pb-0">
        <div className="page-container py-7 sm:py-10">
          <Breadcrumbs items={buildJobBreadcrumbs(job, allJobs)} />

          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <article className="min-w-0">
              <header className="border-b border-border pb-8">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary sm:h-14 sm:w-14">
                    <BriefcaseBusiness size={26} strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="break-words text-2xl font-extrabold leading-tight tracking-[-0.05em] sm:text-4xl">
                      {job.title}
                    </h1>
                    <p className="mt-2 truncate text-base font-semibold text-muted">
                      {job.company}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} /> {job.city}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} /> Publicado{" "}
                    {job.publishedLabel.toLowerCase()}
                  </span>
                  <span className="tag tag-primary">{job.sector}</span>
                  <span className="tag">{job.contract}</span>
                  <span className="tag">{job.profession}</span>
                </div>
                {categoryLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {categoryLinks.map((link) => (
                      <Link key={link.href} href={link.href} className="filter-chip">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
                <ShareButtons
                  url={shareUrl}
                  title={job.title}
                  summary={`${job.company} · ${job.city}`}
                />
              </header>

              <div className="job-content">
                <section>
                  <h2>Sobre la oferta</h2>
                  <JobDescription text={job.description} />
                </section>
                <CheckList title="Qué buscamos" items={job.requirements} />
                <CheckList
                  title="Funciones"
                  items={job.responsibilities}
                />
              </div>
            </article>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              <div className="content-card p-5">
                <h2 className="font-extrabold">Resumen de la oferta</h2>
                <dl className="mt-4 divide-y divide-border rounded-xl border border-border text-sm">
                  {[
                    ["Ubicación", job.city],
                    ["Sector", job.sector],
                    ["Contrato", job.contract],
                    ["Publicada", job.publishedLabel],
                  ].map(([term, value]) => (
                    <div
                      key={term}
                      className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3"
                    >
                      <dt className="text-muted">{term}</dt>
                      <dd className="font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <SalaryInsight job={job} />
                </div>
                <div className="mt-5 flex gap-2">
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="button button-primary flex-1 text-center"
                    {...applyTrackingProps(job, "sidebar")}
                  >
                    <span className="truncate">Inscribirme</span>
                    <ExternalLink size={16} className="shrink-0" />
                  </a>
                  <FavoriteButton slug={job.slug} size={18} className="detail-fav-button" />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                  <ShieldCheck size={14} className="text-primary" />
                  La solicitud se hace en la web de la entidad.
                </p>
              </div>

              <div className="alert-card">
                <h2 className="font-extrabold">Recibe ofertas parecidas</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Te avisamos cuando aparezca una oportunidad relevante.
                </p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={job.district}
                    defaultProfession={job.profession}
                  />
                </div>
              </div>
            </aside>
          </div>

          {related.length > 0 && (
            <section className="mt-12 border-t border-border pt-9">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">Ofertas relacionadas</h2>
                <Link
                  href={relatedJobsHref(job, allJobs)}
                  rel={relatedJobsHref(job, allJobs).startsWith("/empleo?") ? "nofollow" : undefined}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Ver más
                </Link>
              </div>
              <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <JobCard key={item.slug} job={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 backdrop-blur md:hidden">
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="button button-primary w-full"
          {...applyTrackingProps(job, "mobile")}
        >
          Inscribirme <ExternalLink size={16} />
        </a>
      </div>
      <Footer />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  );
}

function ExpiredJobView({ job, allJobs }: { job: Job; allJobs: Job[] }) {
  const similar = allJobs
    .filter(
      (item) =>
        item.slug !== job.slug &&
        (item.profession === job.profession || item.district === job.district),
    )
    .sort((a, b) => scoreRelated(b, job) - scoreRelated(a, job))
    .slice(0, 6);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);

  return (
    <>
      <Header />
      <main>
        <div className="page-container py-7 sm:py-10">
          <Breadcrumbs items={buildJobBreadcrumbs(job, allJobs)} />

          <div className="content-card border-amber-500/30 bg-amber-500/5 p-5 sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Oferta cerrada
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-2 text-muted">
              {job.company} · {job.city}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Esta oferta ya no está activa. Puedes explorar oportunidades
              parecidas más abajo o crear una alerta para {job.profession}
              {job.district ? ` ${enLugar(job.district)}` : ""}.
            </p>
            {categoryLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categoryLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="filter-chip">
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section>
              <h2 className="section-title">Ofertas parecidas</h2>
              {similar.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {similar.map((item) => (
                    <JobCard key={item.slug} job={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Ahora mismo no hay ofertas parecidas activas.{" "}
                  <Link href="/empleo" className="font-bold text-primary">
                    Ver todas
                  </Link>
                </p>
              )}
            </section>
            <aside>
              <div className="alert-card">
                <h2 className="font-extrabold">Crear alerta</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Te avisamos cuando surjan nuevas oportunidades.
                </p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={job.district}
                    defaultProfession={job.profession}
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function buildJobCategoryLinks(job: Job, allJobs: Job[]) {
  const links: Array<{ href: string; label: string }> = [];
  if (isCategoryEligible(allJobs, job.profession, null)) {
    links.push({
      href: categoryPath(job.profession, null),
      label: job.profession,
    });
  }
  if (isCategoryEligible(allJobs, null, job.district)) {
    links.push({
      href: categoryPath(null, job.district),
      label: job.district,
    });
  }
  if (isCategoryEligible(allJobs, job.profession, job.district)) {
    links.push({
      href: categoryPath(job.profession, job.district),
      label: `${job.profession} ${enLugar(job.district)}`,
    });
  }
  return links;
}

/** Inicio › Empleo › profesión › profesión × comunidad › oferta (solo landings que existen). */
function buildJobBreadcrumbs(job: Job, allJobs: Job[]): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: "Inicio", href: "/" },
    { label: "Empleo", href: "/empleo" },
  ];
  if (isCategoryEligible(allJobs, job.profession, null)) {
    items.push({ label: job.profession, href: categoryPath(job.profession, null) });
    if (job.district && isCategoryEligible(allJobs, job.profession, job.district)) {
      items.push({
        label: job.district,
        href: categoryPath(job.profession, job.district),
      });
    }
  } else if (job.district && isCategoryEligible(allJobs, null, job.district)) {
    items.push({ label: job.district, href: categoryPath(null, job.district) });
  }
  items.push({ label: job.title });
  return items;
}

function CheckList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <Check size={17} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Ver más": landing de categoría cuando existe (enlace interno indexable). */
function relatedJobsHref(job: Job, allJobs: Job[]) {
  if (isCategoryEligible(allJobs, job.profession, job.district)) {
    return categoryPath(job.profession, job.district);
  }
  if (isCategoryEligible(allJobs, job.profession, null)) {
    return categoryPath(job.profession, null);
  }
  const qs = new URLSearchParams({ profesion: job.profession });
  if (job.district) qs.set("comunidad", job.district);
  return `/empleo?${qs.toString()}`;
}
