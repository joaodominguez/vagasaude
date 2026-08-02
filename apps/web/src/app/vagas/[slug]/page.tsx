import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { CategoryPageView } from "@/components/category-page-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
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

export const dynamic = "force-dynamic";

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
    return buildCategoryMetadata(category, jobs.length);
  }

  const found = await getJob(slug);
  if (!found) return { title: "Vaga não encontrada" };
  const meta = buildJobMetadata(found.job);
  if (found.expired) {
    return {
      ...meta,
      title: `${found.job.title} (vaga encerrada)`,
      robots: { index: true, follow: true },
    };
  }
  return meta;
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
        ref={category}
        jobs={jobs}
        allCategoryRefs={listEligibleCategories(allJobs)}
      />
    );
  }

  // Slug reservado a categoria sem inventário suficiente → listagem filtrada.
  if (category) {
    const paramsQs = new URLSearchParams();
    if (category.profession) paramsQs.set("profissao", category.profession);
    if (category.district) paramsQs.set("distrito", category.district);
    redirect(`/vagas?${paramsQs.toString()}`);
  }

  const found = await getJob(slug);
  if (!found) notFound();

  if (found.expired) {
    return <ExpiredJobView job={found.job} allJobs={allJobs} />;
  }

  return <ActiveJobView job={found.job} allJobs={allJobs} />;
}

function ActiveJobView({ job, allJobs }: { job: Job; allJobs: Job[] }) {
  const related = allJobs
    .filter(
      (item) =>
        item.slug !== job.slug &&
        (item.profession === job.profession || item.district === job.district),
    )
    .slice(0, 3);

  const jsonLd = buildJobPostingJsonLd(job);
  const shareUrl = jobUrl(job.slug);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);

  return (
    <>
      <Header />
      <main className="pb-24 md:pb-0">
        <div className="page-container py-7 sm:py-10">
          <Link
            href="/vagas"
            className="mb-7 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary"
          >
            <ArrowLeft size={16} /> Voltar às vagas
          </Link>

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
                  <h2>Sobre a vaga</h2>
                  <p>{job.description}</p>
                </section>
                <CheckList title="O que procuramos" items={job.requirements} />
                <CheckList
                  title="Responsabilidades"
                  items={job.responsibilities}
                />
              </div>
            </article>

            <aside className="space-y-4">
              <div className="content-card sticky top-24 p-5">
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
                <a
                  href={job.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="button button-primary mt-5 w-full text-center"
                >
                  <span className="truncate">Candidatar no site da entidade</span>
                  <ExternalLink size={16} className="shrink-0" />
                </a>
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
            </aside>
          </div>

          {related.length > 0 && (
            <section className="mt-12 border-t border-border pt-9">
              <h2 className="section-title">Vagas relacionadas</h2>
              <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-3">
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
        >
          Candidatar <ExternalLink size={16} />
        </a>
      </div>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
    .slice(0, 6);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);

  return (
    <>
      <Header />
      <main>
        <div className="page-container py-7 sm:py-10">
          <Link
            href="/vagas"
            className="mb-7 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary"
          >
            <ArrowLeft size={16} /> Voltar às vagas
          </Link>

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
      label: `${job.profession} em ${job.district}`,
    });
  }
  return links;
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
