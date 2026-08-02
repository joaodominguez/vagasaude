import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { getJob, getJobs } from "@/lib/jobs-data";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return {};

  return {
    title: `${job.title} — ${job.company}`,
    description: `${job.title} em ${job.city}. Consulta os requisitos e candidata-te no site da entidade.`,
    alternates: { canonical: `/vagas/${job.slug}` },
  };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();

  const allJobs = await getJobs();
  const related = allJobs
    .filter(
      (item) =>
        item.slug !== job.slug &&
        (item.profession === job.profession || item.district === job.district),
    )
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt,
    employmentType: job.contract,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.district,
        addressCountry: "PT",
      },
    },
    directApply: false,
  };

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
                  <AlertForm compact />
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
