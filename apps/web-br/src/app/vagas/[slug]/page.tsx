import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { applyTrackingProps } from "@/lib/analytics";
import { ArticlesGuideCta } from "@/components/articles-guide-cta";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { CategoryPageView } from "@/components/category-page-view";
import { FavoriteButton } from "@/components/favorite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JobTypeBadge } from "@/components/job-type-badge";
import { JobDescription } from "@/components/job-description";
import { SalaryInsight } from "@/components/salary-insight";
import { ShareButtons } from "@/components/share-buttons";
import { buildConcursoSummary, isConcursoJob } from "@/lib/concursos";
import {
  buildCategoryMetadata,
  categoryPath,
  filterJobsForCategory,
  isCategoryEligible,
  jobSubProfession,
  listEligibleCategories,
  resolveCategoryFromSegments,
  fallbackCategoryPath,
} from "@/lib/categories";
import { cityRefOfJob } from "@/lib/cities";
import {
  concursosPath,
  filterConcursos,
  listConcursos,
  listEligibleConcursos,
} from "@/lib/concursos-hub";
import { classifyJob } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";
import { relatedJobs } from "@/lib/related-jobs";
import { LEGACY_SLUG_REDIRECTS } from "@/lib/slug-redirects";
import { getJob, getListingJobs } from "@/lib/jobs-data";
import { buildJobMetadata, buildJobPostingJsonLd, jobUrl } from "@/lib/seo";

// force-static + revalidate: HTML ISR on-demand (revalidate sozinho não
// chega porque os dados vinham de fs sem Data Cache). Soft-expire 10 min.
export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const allJobs = await getListingJobs();
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
    return buildCategoryMetadata(category, jobs.length);
  }

  const found = await getJob(slug);
  if (!found) return { title: "Vaga não encontrada", robots: { index: false } };
  const metadata = buildJobMetadata(found.job, {
    expired: found.expired,
    canonicalSlug: found.canonicalSlug,
  });
  if (isConcursoJob(found.job)) {
    // Notícia/edital de concurso: noindex até haver secção própria de concursos.
    return { ...metadata, robots: { index: false, follow: true } };
  }
  return metadata;
}

export default async function VagasSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const allJobs = await getListingJobs();
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
  if (!found) {
    const legacy = LEGACY_SLUG_REDIRECTS[slug];
    if (legacy) permanentRedirect(`/vagas/${legacy}`);
    notFound();
  }

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

  const concurso = isConcursoJob(job);
  const concursoSummary = concurso ? buildConcursoSummary(job) : null;
  // Concursos não são vagas de um empregador: sem JobPosting (Google for Jobs).
  // Republicações também sem JobPosting (só a vaga principal).
  const jsonLd = concurso || canonicalSlug ? null : buildJobPostingJsonLd(job);
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
                  <JobTypeBadge job={job} />
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

              {concursoSummary ? (
                <div className="job-content">
                  <section>
                    <h2>Sobre o concurso</h2>
                    <p>{concursoSummary.description}</p>
                  </section>
                  {concursoSummary.cargos.length > 0 && (
                    <CheckList
                      title="Cargos da área da saúde"
                      items={concursoSummary.cargos}
                    />
                  )}
                  <section>
                    <h2>Edital e inscrições</h2>
                    <p>
                      <a
                        href={job.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        {...applyTrackingProps(job, "edital")}
                      >
                        Ler a notícia completa e o edital na fonte
                      </a>
                      .
                    </p>
                  </section>
                </div>
              ) : (
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
                </div>
              )}
            </article>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              <div className="content-card p-5">
                <h2 className="font-extrabold">Resumo da vaga</h2>
                <dl className="mt-4 divide-y divide-border rounded-xl border border-border text-sm">
                  {[
                    ["Localização", job.city],
                    ["Setor", job.sector],
                    ["Contrato", job.contract],
                    ["Publicado", job.publishedLabel],
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
                    <span className="truncate">Candidate-se</span>
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
                <h2 className="font-extrabold">Receba vagas semelhantes</h2>
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

              <ArticlesGuideCta
                profession={job.profession}
                sector={job.sector}
              />
            </aside>
          </div>

          {related.length > 0 && (
            <section className="mt-12 border-t border-border pt-9">
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
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 backdrop-blur md:hidden">
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="button button-primary w-full"
          {...applyTrackingProps(job, "mobile")}
        >
          Candidate-se <ExternalLink size={16} />
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
              Esta vaga já não está ativa. Você pode explorar oportunidades
              semelhantes abaixo ou criar um alerta para {job.profession}
              {job.district ? ` em ${job.district}` : ""}.
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
              <h2 className="section-title">Vagas semelhantes</h2>
              {similar.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {similar.map((item) => (
                    <JobCard key={item.slug} job={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Neste momento não há vagas semelhantes ativas.{" "}
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
                  Avisamos você quando surgirem novas oportunidades.
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
      label: `${job.profession} em ${job.district}`,
    });
  }
  const sub = jobSubProfession(job);
  if (sub && isCategoryEligible(allJobs, sub, null)) {
    links.push({ href: categoryPath(sub, null), label: sub });
  }
  if (sub && job.district && isCategoryEligible(allJobs, sub, job.district)) {
    links.push({
      href: categoryPath(sub, job.district),
      label: `${sub} em ${job.district}`,
    });
  }
  const city = cityRefOfJob(allJobs, job);
  if (city) links.push({ href: city.path, label: `Vagas em ${city.name}` });
  if (classifyJob(job) !== "oferta") {
    const eligible = new Set(
      listEligibleConcursos(listConcursos(allJobs)).map((ref) => ref.path),
    );
    links.push({ href: "/concursos", label: "Concursos na saúde" });
    const leaf = sub ?? job.profession;
    if (eligible.has(concursosPath(leaf))) {
      links.push({ href: concursosPath(leaf), label: `Concursos de ${leaf.toLowerCase()}` });
    }
  }
  return links;
}

/** Início › Vagas › profissão › [sub-profissão] › profissão × estado › vaga (só landings que existem). */
function buildJobBreadcrumbs(job: Job, allJobs: Job[]): BreadcrumbItem[] {
  if (classifyJob(job) !== "oferta") {
    // Editais: Início › Concursos › [profissão] › vaga.
    const crumbs: BreadcrumbItem[] = [
      { label: "Início", href: "/" },
      { label: "Concursos", href: "/concursos" },
    ];
    const leaf = jobSubProfession(job) ?? job.profession;
    if (filterConcursos(listConcursos(allJobs), leaf, null).length > 0) {
      crumbs.push({ label: leaf, href: concursosPath(leaf) });
    }
    crumbs.push({ label: job.title });
    return crumbs;
  }
  const items: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Vagas", href: "/vagas" },
  ];
  if (isCategoryEligible(allJobs, job.profession, null)) {
    items.push({ label: job.profession, href: categoryPath(job.profession, null) });
    const sub = jobSubProfession(job);
    const leaf =
      sub && isCategoryEligible(allJobs, sub, null) ? sub : job.profession;
    if (leaf !== job.profession) {
      items.push({ label: leaf, href: categoryPath(leaf, null) });
    }
    if (job.district && isCategoryEligible(allJobs, leaf, job.district)) {
      items.push({ label: job.district, href: categoryPath(leaf, job.district) });
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

/** "Ver mais": landing de categoria quando existe (ligação interna indexável). */
function relatedJobsHref(job: Job, allJobs: Job[]) {
  const sub = jobSubProfession(job);
  if (sub && isCategoryEligible(allJobs, sub, job.district)) {
    return categoryPath(sub, job.district);
  }
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
