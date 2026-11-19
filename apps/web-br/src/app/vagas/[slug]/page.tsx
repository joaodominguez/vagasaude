import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { applyTrackingProps } from "@/lib/analytics";
import { ArticlesGuideCta } from "@/components/articles-guide-cta";
import { BreadcrumbJsonLd, Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { CategoryPageView } from "@/components/category-page-view";
import { FavoriteButton } from "@/components/favorite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JobIcon } from "@/components/profession-icon";
import { JobSummary } from "@/components/job-summary";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { SalaryReference } from "@/components/salary-reference";
import { JobDescription } from "@/components/job-description";
import { SalaryInsight } from "@/components/salary-insight";
import { SaveShareRow } from "@/components/share-buttons";
import { buildConcursoSummary, isConcursoJob } from "@/lib/concursos";
import {
  buildCategoryMetadata,
  categoryPath,
  toCategorySlug,
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
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { displayTitle } from "@/lib/display-title";
import {
  announcedSalaryLabel,
  contractBesideType,
  deadlineLabel,
  distinctItems,
  publishedSentence,
  trimTruncatedExcerpt,
} from "@/lib/job-display";
import {
  extractCouncil,
  extractSchedule,
  jobFullText,
  shiftChipLabel,
  specialtyFromTitle,
} from "@/lib/job-facts";
import { splitOffering } from "@/lib/job-sections";
import { findEmployer } from "@/lib/employers";
import { SOURCE_META } from "@/lib/sources";
import type { Job } from "@/lib/jobs";
import { relatedJobs } from "@/lib/related-jobs";
import { LEGACY_SLUG_REDIRECTS } from "@/lib/slug-redirects";
import { getJob, getListingJobs } from "@/lib/jobs-data";
import { buildJobMetadata, buildJobPostingJsonLd, jobUrl } from "@/lib/seo";
import { isIndexableJob } from "@/lib/indexable";

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
  if (!isIndexableJob(found.job)) {
    // Recuperação BR: funções não clínicas e bancos de talentos não vão ao Google (lib/indexable.ts).
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
  // Não indexáveis (lib/indexable.ts) também sem JobPosting.
  const jsonLd = concurso || canonicalSlug || !isIndexableJob(job) ? null : buildJobPostingJsonLd(job);
  const shareUrl = jobUrl(job.slug);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);
  const back = buildBackLink(job, allJobs);
  const employer = findEmployer(allJobs, toCategorySlug(job.company || ""));

  const type = classifyJob(job);
  const isEdital = concurso || type !== "oferta";
  const isPublic = isPublicJob(job);
  // H1: nos concursos/editais o título completo; nas vagas, o título limpo.
  const title = isEdital ? job.title : displayTitle(job.title, job);
  const cardTitle = displayTitle(job.title, job);
  const contract = contractBesideType(job);
  // Em editais agregados (PCI/INCA) o valor pode ser de outro cargo ou taxa de inscrição.
  const salary = concurso ? null : announcedSalaryLabel(job.salary);
  const published = publishedSentence(job.publishedAt);
  const deadline = deadlineLabel(job.expiresAt);
  const text = jobFullText(job);
  const schedule = extractSchedule(text, job.contract);
  const shiftChip = shiftChipLabel(schedule);
  const specialty = specialtyFromTitle(job.title);

  // Descrição uma só vez; «O que oferecemos» à parte; requisitos/responsabilidades só se acrescentam texto.
  const excerpt = trimTruncatedExcerpt(job.description);
  const { blocks, offering } = splitOffering(excerpt.text);
  const requirements = distinctItems(job.requirements, job.description);
  const responsibilities = distinctItems(
    job.responsibilities,
    job.description,
    job.requirements,
  );
  // Nome curto da fonte, para a remissão ao anúncio completo.
  const sourceName = job.source
    ? SOURCE_META[job.source]?.name?.split(/\s+[—–]\s+/)[0]
    : undefined;
  const applyLabel = isEdital
    ? "Ver o edital na fonte"
    : job.company && job.company.length <= 30
      ? `Candidatar-se em ${job.company}`
      : isPublic
        ? "Candidatar-se no site do órgão"
        : "Candidatar-se no site da empresa";
  const alertScope = [job.profession, job.district].filter(Boolean).join(" · ");

  return (
    <>
      <Header />
      <main className="pb-24 md:pb-0">
        <div className="page-container py-5 sm:py-8">
          {/* O breadcrumb visível dá lugar a um link curto; o JSON-LD continua igual. */}
          <BreadcrumbJsonLd items={buildJobBreadcrumbs(job, allJobs)} />
          <Link href={back.href} className="job-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {back.label}
          </Link>

          <div className="mt-3 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
            <article className="min-w-0">
              <header className="border-b border-border pb-7">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <JobIcon profession={job.profession} concorso={isEdital} large />
                  <div className="min-w-0">
                    <h1 className="break-words text-2xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">
                      {title}
                    </h1>
                    <p className="mt-1.5 text-base font-semibold text-muted sm:text-lg">
                      {job.company}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label="Dados da vaga">
                  {specialty && <li className="fact-chip fact-chip-primary">{specialty}</li>}
                  {job.city && (
                    <li className="fact-chip">
                      <MapPin size={14} aria-hidden="true" />
                      {job.city}
                    </li>
                  )}
                  <li className={isPublic ? "fact-chip fact-chip-public" : "fact-chip"}>
                    {isPublic ? "Público" : job.sector === "Filantrópico" ? "Filantrópico" : "Privado"}
                  </li>
                  {type !== "oferta" && <li className="fact-chip">{JOB_TYPE_LABEL[type]}</li>}
                  {contract && <li className="fact-chip">{contract}</li>}
                  {shiftChip && <li className="fact-chip">{shiftChip}</li>}
                  {deadline && <li className="fact-chip fact-chip-deadline">{deadline}</li>}
                  {salary && <li className="fact-chip fact-chip-salary">{salary}</li>}
                  {published && <li className="fact-chip">{published}</li>}
                </ul>
              </header>

              {concursoSummary ? (
                <div className="job-content">
                  <JobSummary job={job} />
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
                  <JobSummary job={job} />
                  <section>
                    <h2>Sobre a vaga</h2>
                    <JobDescription blocks={blocks} />
                    {excerpt.truncated && (
                      <p className="job-excerpt-note">
                        Este é um trecho publicado pela fonte.{" "}
                        <a
                          href={job.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          Leia o anúncio completo{sourceName ? ` em ${sourceName}` : " na fonte"}
                        </a>
                      </p>
                    )}
                  </section>
                  {requirements.length > 0 && (
                    <CheckList title="Perfil procurado" items={requirements} />
                  )}
                  {responsibilities.length > 0 && (
                    <CheckList title="O que você vai fazer" items={responsibilities} />
                  )}
                  {offering.length > 0 && <CheckList title="O que oferecemos" items={offering} />}
                  <section>
                    <h2>Como se candidatar</h2>
                    <ol className="apply-steps">
                      {buildApplySteps(job, isPublic).map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </section>
                </div>
              )}

              {(categoryLinks.length > 0 || employer) && (
                <section className="mt-9 border-t border-border pt-7" aria-labelledby="mais-vagas">
                  <h2 id="mais-vagas" className="text-xl font-extrabold tracking-[-0.03em]">
                    Mais vagas como esta
                  </h2>
                  <div className="explore-links">
                    {categoryLinks.map((link) => (
                      <Link prefetch={false} key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                    {employer && (
                      <Link prefetch={false} href={employer.path}>
                        Outras vagas de {employer.name} ({employer.jobs.length})
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </article>

            <aside className="min-w-0 space-y-4 lg:self-stretch">
              <div className="content-card apply-card z-10 space-y-3 p-5 lg:sticky lg:top-24">
                <div className="hidden lg:block">
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="button button-primary w-full text-center"
                    style={{ minHeight: "3.25rem", fontSize: "1rem" }}
                    {...applyTrackingProps(job, "sidebar")}
                  >
                    <span>{applyLabel}</span>
                    <ExternalLink size={16} className="shrink-0" aria-hidden="true" />
                  </a>
                </div>
                <SaveShareRow
                  slug={job.slug}
                  url={shareUrl}
                  title={cardTitle}
                  summary={`${job.company} · ${job.city}`}
                />
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                  <ShieldCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
                  A candidatura é feita no site da entidade.
                </p>
              </div>

              {!concurso && <SalaryInsight job={job} />}
              <SalaryReference job={job} />

              <div className="alert-card">
                <h2 className="font-extrabold">Receba vagas como esta</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {alertScope ? `${alertScope}. ` : ""}No máximo 2 e-mails por dia.
                </p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={job.district}
                    defaultProfession={job.profession}
                  />
                </div>
                <SocialAlertLinks className="mt-3" />
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
                <div>
                  <span className="section-kicker">Na mesma área</span>
                  <h2 className="section-title">Vagas relacionadas</h2>
                </div>
                <Link
                  href={relatedJobsHref(job, allJobs)}
                  rel={relatedJobsHref(job, allJobs).startsWith("/vagas?") ? "nofollow" : undefined}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Ver mais
                </Link>
              </div>
              <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
                {related.map((item) => (
                  <JobCard key={item.slug} job={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-surface/95 p-3 backdrop-blur md:hidden">
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="button button-primary flex-1"
          {...applyTrackingProps(job, "mobile")}
        >
          {isEdital ? "Ver o edital" : "Candidatar-se"} <ExternalLink size={16} aria-hidden="true" />
        </a>
        <FavoriteButton slug={job.slug} size={20} className="detail-fav-button" />
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

/** Passos genéricos (nenhum dado inventado): dependem só do setor da vaga. */
function buildApplySteps(job: Job, isPublic: boolean): string[] {
  const council = extractCouncil(jobFullText(job));
  return [
    council
      ? `Prepare o currículo atualizado e o número do seu registro no ${council}.`
      : "Prepare o currículo atualizado e, se pedido, o número do seu registro no conselho profissional.",
    isPublic
      ? "Candidate-se no site do órgão (botão Candidatar-se)."
      : "Candidate-se no site da empresa (botão Candidatar-se).",
  ];
}

/** Link curto de volta: «Concursos: <profissão>» / «Vagas de <profissão> em <estado>» (landing existente). */
function buildBackLink(job: Job, allJobs: Job[]): { href: string; label: string } {
  const sub = jobSubProfession(job);
  const leaf = sub ?? job.profession;
  if (classifyJob(job) !== "oferta" || isConcursoJob(job)) {
    const eligible = new Set(
      listEligibleConcursos(listConcursos(allJobs)).map((ref) => ref.path),
    );
    if (eligible.has(concursosPath(leaf))) {
      return { href: concursosPath(leaf), label: `Concursos: ${leaf}` };
    }
    return { href: "/concursos", label: "Concursos na saúde" };
  }
  if (job.district && sub && isCategoryEligible(allJobs, sub, job.district)) {
    return { href: categoryPath(sub, job.district), label: `Vagas de ${sub} em ${job.district}` };
  }
  if (job.district && isCategoryEligible(allJobs, job.profession, job.district)) {
    return {
      href: categoryPath(job.profession, job.district),
      label: `Vagas de ${job.profession} em ${job.district}`,
    };
  }
  if (isCategoryEligible(allJobs, job.profession, null)) {
    return { href: categoryPath(job.profession, null), label: `Vagas de ${job.profession}` };
  }
  if (job.district && isCategoryEligible(allJobs, null, job.district)) {
    return { href: categoryPath(null, job.district), label: `Vagas em ${job.district}` };
  }
  return { href: "/vagas", label: "Todas as vagas" };
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
