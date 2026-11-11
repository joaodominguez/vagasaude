import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { applyTrackingProps } from "@/lib/analytics";
import { CategoryPageView } from "@/components/category-page-view";
import { GuidesCta } from "@/components/guides-cta";
import { FavoriteButton } from "@/components/favorite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JobTypeBadge } from "@/components/job-type-badge";
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
  fallbackCategoryPath,
} from "@/lib/categories";
import { concursosPath, hasConcursoLanding, listConcursos } from "@/lib/concursos";
import { concelhoPath, isConcelhoEligible, jobConcelho } from "@/lib/concelhos";
import { classifyJob } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";
import { relatedJobs } from "@/lib/related-jobs";
import { getJob, getJobs } from "@/lib/jobs-data";
import { buildJobMetadata, buildJobPostingJsonLd, jobUrl } from "@/lib/seo";
import { emLocal } from "@/lib/pt-locative";

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
  if (!found) return { title: "Vaga não encontrada", robots: { index: false } };
  return buildJobMetadata(found.job, {
    expired: found.expired,
    canonicalSlug: found.canonicalSlug,
  });
}

export default async function VagasSlugPage({ params }: { params: Params }) {
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

  // Slug reservado a categoria sem inventário suficiente → listagem filtrada.
  if (category) {
    redirect(fallbackCategoryPath(allJobs, category.profession, category.district));
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


function ActiveJobView({
  job,
  allJobs,
  canonicalSlug,
}: {
  job: Job;
  allJobs: Job[];
  canonicalSlug?: string;
}) {
  const related = relatedJobs(job, allJobs);

  // Republicação de outra vaga: sem JobPosting (só a vaga principal).
  const jsonLd = canonicalSlug ? null : buildJobPostingJsonLd(job);
  const shareUrl = jobUrl(job.slug);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);
  const professionHref = isCategoryEligible(allJobs, job.profession, null)
    ? categoryPath(job.profession, null)
    : null;
  const moreLinks = categoryLinks.filter((link) => link.label !== job.profession);

  return (
    <>
      <div className="job-detail">
      <Header />
      <main>
        <div className="page-container py-5 sm:py-10">
          <Breadcrumbs items={buildJobBreadcrumbs(job, allJobs)} />

          <div className="job-layout">
            <article className="job-main min-w-0">
              <header>
                <h1 className="break-words text-2xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">
                  {job.title}
                </h1>
                <p className="mt-2 text-base font-semibold leading-snug">
                  {job.company}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  {professionHref ? (
                    <Link
                      prefetch={false}
                      href={professionHref}
                      className="font-semibold text-primary hover:underline"
                    >
                      {job.profession}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted">{job.profession}</span>
                  )}
                  <JobTypeBadge job={job} />
                </p>
                <JobFacts job={job} />
                <div className="mt-3">
                  <SalaryInsight job={job} />
                </div>
              </header>

              <div className="job-content">
                <section>
                  <h2>Sobre a vaga</h2>
                  <JobDescription text={job.description} />
                </section>
                <CheckList title="O que procuramos" items={job.requirements} />
                <CheckList
                  title="Responsabilidades"
                  items={job.responsibilities}
                />
                <ShareButtons
                  url={shareUrl}
                  title={job.title}
                  summary={`${job.company} · ${job.city}`}
                />
                {moreLinks.length > 0 && (
                  <nav className="mt-6" aria-label="Mais vagas">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {moreLinks.map((link) => (
                        <Link
                          prefetch={false}
                          key={link.href}
                          href={link.href}
                          className="font-semibold text-primary hover:underline"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </nav>
                )}
              </div>
            </article>

            <aside className="job-aside">
              <div className="content-card hidden p-5 lg:block">
                <h2 className="font-extrabold">Candidatura</h2>
                <div className="mt-4 flex gap-2">
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="button button-primary min-w-0 flex-1 text-center"
                    {...applyTrackingProps(job, "sidebar")}
                  >
                    <span className="truncate">Candidatar</span>
                    <ExternalLink size={16} className="shrink-0" />
                  </a>
                  <FavoriteButton slug={job.slug} size={18} className="detail-fav-button" />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                  <ShieldCheck size={14} className="text-primary" />
                  A candidatura é feita no site da entidade.
                </p>
              </div>

              <div className="alert-card">
                <h2 className="font-extrabold">Recebe vagas semelhantes</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Avisamos quando surgir uma oportunidade relevante.
                </p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={job.district}
                    defaultProfession={job.profession}
                  />
                </div>
              </div>

              <GuidesCta profession={job.profession} sector={job.sector} />
            </aside>

            {related.length > 0 && (
              <section className="job-related border-t border-border pt-8">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="section-title">Vagas relacionadas</h2>
                  <Link
                    href={relatedJobsHref(job, allJobs)}
                    rel={relatedJobsHref(job, allJobs).startsWith("/vagas?") ? "nofollow" : undefined}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Ver mais
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
        </div>
      </main>
      <Footer />
      </div>

      <div className="job-apply-bar">
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="button button-primary min-w-0 flex-1"
          {...applyTrackingProps(job, "mobile")}
        >
          Candidatar <ExternalLink size={16} />
        </a>
        <FavoriteButton slug={job.slug} size={18} className="detail-fav-button" />
      </div>
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
  const similar = relatedJobs(job, allJobs);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);

  return (
    <>
      <Header />
      <main>
        <div className="page-container py-7 sm:py-10">
          <Breadcrumbs items={buildJobBreadcrumbs(job, allJobs)} />

          <div className="content-card border-amber-500/30 bg-amber-500/5 p-5 sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Vaga encerrada
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-2 text-muted">
              {job.company} · {job.city}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Esta vaga já não está activa. Podes explorar oportunidades
              semelhantes abaixo ou criar um alerta para {job.profession}
              {job.district ? ` ${emLocal(job.district)}` : ""}.
            </p>
            {categoryLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categoryLinks.map((link) => (
                  <Link prefetch={false} key={link.href} href={link.href} className="filter-chip">
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section>
              <h2 className="section-title">Vagas semelhantes</h2>
              {similar.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {similar.map((item) => (
                    <JobCard key={item.slug} job={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Neste momento não há vagas semelhantes activas.{" "}
                  <Link href="/vagas" className="font-bold text-primary">
                    Ver todas
                  </Link>
                </p>
              )}
            </section>
            <aside>
              <div className="alert-card">
                <h2 className="font-extrabold">Criar alerta</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Avisamos-te quando surgirem novas oportunidades.
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
      label: `${job.profession} ${emLocal(job.district)}`,
    });
  }
  const concelho = jobConcelho(job);
  if (concelho && isConcelhoEligible(allJobs, job.district, concelho)) {
    links.push({
      href: concelhoPath(job.district, concelho),
      label: `Vagas ${emLocal(concelho)}`,
    });
  }
  return links;
}

/** Início › Vagas › profissão › profissão × distrito › vaga (só landings que existem). */
function buildJobBreadcrumbs(job: Job, allJobs: Job[]): BreadcrumbItem[] {
  // Procedimentos públicos: Início › Concursos › Profissão › vaga.
  if (
    classifyJob(job) !== "oferta" &&
    hasConcursoLanding(listConcursos(allJobs), job.profession)
  ) {
    return [
      { label: "Início", href: "/" },
      { label: "Concursos", href: "/concursos" },
      { label: job.profession, href: concursosPath(job.profession) },
      { label: job.title },
    ];
  }
  const items: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Vagas", href: "/vagas" },
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

function JobFacts({ job }: { job: Job }) {
  const facts = [
    ["Local", job.city],
    ["Contrato", job.contract || "A definir"],
    ["Setor", job.sector],
    ["Publicado", job.publishedLabel],
  ];

  return (
    <dl className="job-facts">
      {facts.map(([term, value]) => (
        <div key={term} className="job-fact">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
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

/** "Ver mais": landing de categoria quando existe (ligação interna indexável). */
function relatedJobsHref(job: Job, allJobs: Job[]) {
  if (isCategoryEligible(allJobs, job.profession, job.district)) {
    return categoryPath(job.profession, job.district);
  }
  if (isCategoryEligible(allJobs, job.profession, null)) {
    return categoryPath(job.profession, null);
  }
  const qs = new URLSearchParams({ profissao: job.profession });
  if (job.district) qs.set("distrito", job.district);
  return `/vagas?${qs.toString()}`;
}
