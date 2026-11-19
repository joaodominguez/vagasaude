import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { GuideCta } from "@/components/guide-cta";
import { BreadcrumbJsonLd, Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { applyTrackingProps } from "@/lib/analytics";
import { CategoryPageView } from "@/components/category-page-view";
import { FavoriteButton } from "@/components/favorite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JobIcon } from "@/components/profession-icon";
import { JobSummary } from "@/components/job-summary";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { JobDescription } from "@/components/job-description";
import { SalaryInsight } from "@/components/salary-insight";
import { SaveShareRow } from "@/components/share-buttons";
import {
  buildCategoryMetadata,
  categoryPath,
  toCategorySlug,
  filterJobsForCategory,
  isCategoryEligible,
  listEligibleCategories,
  provincePath,
  resolveCategoryFromSegments,
  fallbackCategoryPath,
} from "@/lib/categories";
import type { Job } from "@/lib/jobs";
import { relatedJobs } from "@/lib/related-jobs";
import { getJob, getJobs } from "@/lib/jobs-data";
import { buildJobMetadata, buildJobPostingJsonLd, jobUrl } from "@/lib/seo";
import { inRegione } from "@/lib/it-locative";
import { classifyJob, isConcorsoJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import { displayTitle } from "@/lib/display-title";
import {
  announcedSalaryLabel,
  contractBesideType,
  deadlineLabel,
  distinctItems,
  publishedSentence,
  trimTruncatedExcerpt,
} from "@/lib/job-display";
import { extractSchedule, jobFullText, specialtyFromTitle } from "@/lib/job-facts";
import { splitOffering } from "@/lib/job-sections";
import { findEmployer } from "@/lib/employers";
import { SOURCE_META } from "@/lib/sources";
import { jobProvince } from "@/lib/provinces";
import { hasConcorsoLanding, listConcorsi, concorsiPath } from "@/lib/concorsi";

// force-static + revalidate: ISR on-demand (il solo revalidate non basta
// se l'albero viene trattato come dinamico per via dell'I/O).
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
  if (!found) return { title: "Offerta non trovata", robots: { index: false } };
  return buildJobMetadata(found.job, {
    expired: found.expired,
    canonicalSlug: found.canonicalSlug,
  });
}

export default async function OffertaSlugPage({ params }: { params: Params }) {
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

  // Slug riservato a una categoria senza offerte sufficienti → elenco filtrato.
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

  // Ripubblicazione di un'altra offerta: senza JobPosting (solo l'offerta principale).
  const jsonLd = canonicalSlug ? null : buildJobPostingJsonLd(job);
  const shareUrl = jobUrl(job.slug);
  const categoryLinks = buildJobCategoryLinks(job, allJobs);
  const back = buildBackLink(job, allJobs);
  const employer = findEmployer(allJobs, toCategorySlug(job.company || ""));

  const type = classifyJob(job);
  const isPublic = isPublicJob(job);
  const title = displayTitle(job.title, job);
  const contract = contractBesideType(job);
  const salary = announcedSalaryLabel(job.salary);
  const published = publishedSentence(job.publishedAt);
  const deadline = deadlineLabel(job.expiresAt);
  const text = jobFullText(job);
  const schedule = extractSchedule(text, job.contract);
  const shiftChip = schedule && /turni/i.test(schedule) ? "Turni" : null;
  const specialty = specialtyFromTitle(job.title);

  // Descrizione una sola volta; «Cosa offriamo» a parte; requisiti/mansioni solo se aggiungono testo.
  const excerpt = trimTruncatedExcerpt(job.description);
  const { blocks, offering } = splitOffering(excerpt.text);
  const requirements = distinctItems(job.requirements, job.description);
  const responsibilities = distinctItems(
    job.responsibilities,
    job.description,
    job.requirements,
  );
  // Nome breve della fonte, per il rimando all'annuncio completo.
  const sourceName = job.source
    ? SOURCE_META[job.source]?.name?.split(/\s+[—–]\s+/)[0]
    : undefined;
  const applyLabel =
    job.company && job.company.length <= 30
      ? `Candidati sul sito di ${job.company}`
      : isPublic
        ? "Candidati sul sito dell'ente"
        : "Candidati sul sito dell'azienda";
  const alertScope = [job.profession, job.district].filter(Boolean).join(" · ");

  return (
    <>
      <Header />
      <main className="pb-24 md:pb-0">
        <div className="page-container py-5 sm:py-8">
          {/* Il breadcrumb visibile lascia il posto a un link breve; il JSON-LD resta uguale. */}
          <BreadcrumbJsonLd items={buildJobBreadcrumbs(job, allJobs)} />
          <Link href={back.href} className="job-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {back.label}
          </Link>

          <div className="mt-3 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
            <article className="min-w-0">
              <header className="border-b border-border pb-7">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <JobIcon profession={job.profession} concorso={type !== "offerta"} large />
                  <div className="min-w-0">
                    <h1 className="break-words text-2xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">
                      {title}
                    </h1>
                    <p className="mt-1.5 text-base font-semibold text-muted sm:text-lg">
                      {job.company}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label="Dati dell'offerta">
                  {specialty && <li className="fact-chip fact-chip-primary">{specialty}</li>}
                  {job.city && (
                    <li className="fact-chip">
                      <MapPin size={14} aria-hidden="true" />
                      {job.city}
                    </li>
                  )}
                  <li className={isPublic ? "fact-chip fact-chip-public" : "fact-chip"}>
                    {isPublic ? "Pubblico" : job.sector === "Accreditato" ? "Accreditato" : "Privato"}
                  </li>
                  {type !== "offerta" && <li className="fact-chip">{JOB_TYPE_LABEL[type]}</li>}
                  {contract && <li className="fact-chip">{contract}</li>}
                  {shiftChip && <li className="fact-chip">{shiftChip}</li>}
                  {deadline && <li className="fact-chip fact-chip-deadline">{deadline}</li>}
                  {salary && <li className="fact-chip fact-chip-salary">{salary}</li>}
                  {published && <li className="fact-chip">{published}</li>}
                </ul>
              </header>

              <div className="job-content">
                <JobSummary job={job} />
                <section>
                  <h2>Sull&apos;offerta</h2>
                  <JobDescription blocks={blocks} />
                  {excerpt.truncated && (
                    <p className="job-excerpt-note">
                      Questo è un estratto pubblicato dalla fonte.{" "}
                      <a
                        href={job.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        Leggi l&apos;annuncio completo{sourceName ? ` su ${sourceName}` : " sulla fonte"}
                      </a>
                    </p>
                  )}
                </section>
                {requirements.length > 0 && (
                  <CheckList title="Profilo richiesto" items={requirements} />
                )}
                {responsibilities.length > 0 && (
                  <CheckList title="Di cosa ti occuperai" items={responsibilities} />
                )}
                {offering.length > 0 && <CheckList title="Cosa offriamo" items={offering} />}
                <section>
                  <h2>Come candidarti</h2>
                  <ol className="apply-steps">
                    {buildApplySteps(job, isPublic, type !== "offerta").map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
              </div>

              {(categoryLinks.length > 0 || employer) && (
                <section className="mt-9 border-t border-border pt-7" aria-labelledby="altre-simili">
                  <h2 id="altre-simili" className="text-xl font-extrabold tracking-[-0.03em]">
                    Altre offerte simili
                  </h2>
                  <div className="explore-links">
                    {categoryLinks.map((link) => (
                      <Link prefetch={false} key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                    {employer && (
                      <Link prefetch={false} href={employer.path}>
                        Altre offerte di {employer.name} ({employer.jobs.length})
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </article>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              <div className="content-card apply-card space-y-3 p-5">
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
                  title={title}
                  summary={`${job.company} · ${job.city}`}
                />
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                  <ShieldCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
                  La candidatura si invia sul sito dell&apos;ente o dell&apos;azienda.
                </p>
              </div>

              <SalaryInsight job={job} />

              <div className="alert-card">
                <h2 className="font-extrabold">Ricevi offerte come questa</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {alertScope ? `${alertScope}. ` : ""}Al massimo 2 email al giorno.
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

              <GuideCta profession={job.profession} sector={job.sector} />
            </aside>
          </div>

          {related.length > 0 && (
            <section className="mt-12 border-t border-border pt-9">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="section-kicker">Nella stessa area</span>
                  <h2 className="section-title">Offerte correlate</h2>
                </div>
                <Link
                  href={relatedJobsHref(job, allJobs)}
                  rel={relatedJobsHref(job, allJobs).startsWith("/offerte?") ? "nofollow" : undefined}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Vedi altre
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
          Candidati <ExternalLink size={16} aria-hidden="true" />
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

/** Passi generici (nessun dato inventato): dipendono solo dal tipo di offerta. */
function buildApplySteps(job: Job, isPublic: boolean, isBando: boolean): string[] {
  if (isBando) {
    return [
      "Leggi il bando completo sul sito dell'ente e verifica requisiti, titoli richiesti e scadenza.",
      "Invia la domanda con le modalità indicate dall'ente (pulsante Candidati).",
    ];
  }
  return [
    "Prepara il curriculum aggiornato e, se richiesto, il numero di iscrizione all'albo o il titolo di studio.",
    isPublic
      ? "Candidati sul sito dell'ente (pulsante Candidati)."
      : "Candidati sul sito dell'azienda (pulsante Candidati).",
  ];
}

/** Link breve di ritorno: «Concorsi: <professione>» / «<Professione> in <regione>» (landing esistente). */
function buildBackLink(job: Job, allJobs: Job[]): { href: string; label: string } {
  if (
    classifyJob(job) !== "offerta" &&
    hasConcorsoLanding(listConcorsi(allJobs), job.profession)
  ) {
    return { href: concorsiPath(job.profession), label: `Concorsi: ${job.profession}` };
  }
  if (job.district && isCategoryEligible(allJobs, job.profession, job.district)) {
    return {
      href: categoryPath(job.profession, job.district),
      label: `${job.profession} ${inRegione(job.district)}`,
    };
  }
  if (isCategoryEligible(allJobs, job.profession, null)) {
    return { href: categoryPath(job.profession, null), label: `Offerte: ${job.profession}` };
  }
  if (job.district && isCategoryEligible(allJobs, null, job.district)) {
    return { href: categoryPath(null, job.district), label: `Offerte ${inRegione(job.district)}` };
  }
  return { href: "/offerte", label: "Tutte le offerte" };
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
              Offerta chiusa
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
              {displayTitle(job.title, job)}
            </h1>
            <p className="mt-2 text-muted">
              {job.company} · {job.city}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Questa offerta non è più attiva. Puoi esplorare opportunità
              simili qui sotto o creare un avviso per {job.profession}
              {job.district ? ` ${inRegione(job.district)}` : ""}.
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
              <h2 className="section-title">Offerte simili</h2>
              {similar.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {similar.map((item) => (
                    <JobCard key={item.slug} job={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Al momento non ci sono offerte simili attive.{" "}
                  <Link href="/offerte" className="font-bold text-primary">
                    Vedi tutte
                  </Link>
                </p>
              )}
            </section>
            <aside>
              <div className="alert-card">
                <h2 className="font-extrabold">Crea avviso</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Ti avvisiamo quando compaiono nuove opportunità.
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
      label: `${job.profession} ${inRegione(job.district)}`,
    });
  }
  const province = jobProvince(job);
  if (province && isCategoryEligible(allJobs, null, job.district, province)) {
    links.push({
      href: provincePath(job.district, province),
      label: `Offerte ${inRegione(province)}`,
    });
  }
  const type = classifyJob(job);
  if (
    type !== "offerta" &&
    hasConcorsoLanding(listConcorsi(allJobs), job.profession)
  ) {
    links.push({
      href: concorsiPath(job.profession),
      label: `Concorsi di ${job.profession === "OSS" ? "OSS" : job.profession.toLowerCase()}`,
    });
  }
  return links;
}

/** Home › Offerte › professione › professione × regione › offerta (solo landing esistenti). */
function buildJobBreadcrumbs(job: Job, allJobs: Job[]): BreadcrumbItem[] {
  // Concorsi/graduatorie/mobilità pubblici: Home › Concorsi › Professione › offerta.
  if (isConcorsoJob(job)) {
    if (!hasConcorsoLanding(listConcorsi(allJobs), job.profession)) {
      return [
        { label: "Home", href: "/" },
        { label: "Concorsi", href: "/concorsi" },
        { label: job.title },
      ];
    }
    return [
      { label: "Home", href: "/" },
      { label: "Concorsi", href: "/concorsi" },
      { label: job.profession, href: concorsiPath(job.profession) },
      { label: job.title },
    ];
  }
  const items: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Offerte", href: "/offerte" },
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

/** "Vedi altre": landing di categoria quando esiste (link interno indicizzabile). */
function relatedJobsHref(job: Job, allJobs: Job[]) {
  if (isCategoryEligible(allJobs, job.profession, job.district)) {
    return categoryPath(job.profession, job.district);
  }
  if (isCategoryEligible(allJobs, job.profession, null)) {
    return categoryPath(job.profession, null);
  }
  const qs = new URLSearchParams({ professione: job.profession });
  if (job.district) qs.set("regione", job.district);
  return `/offerte?${qs.toString()}`;
}
