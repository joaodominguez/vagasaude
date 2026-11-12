import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import {
  EMPLOYER_JOBS_SHOWN,
  employerFaq,
  employerIntro,
  employerStats,
  findEmployer,
  formatMoney,
  hasAnyJobs,
} from "@/lib/employers";
import { getJobs } from "@/lib/jobs-data";
import { SITE_NAME, truncateMeta } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const employer = findEmployer(await getJobs(), slug);
  if (!employer) return { title: "Azienda non trovata", robots: { index: false } };
  const count = employer.jobs.length;
  const title = `${employer.name}: ${count} offerte di lavoro e lavora con noi`;
  const description = truncateMeta(
    `${count} offerte di lavoro presso ${employer.name}: aree, regioni, retribuzioni pubblicate e come candidarti. Aggiornato ogni giorno su ${SITE_NAME}.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: employer.path },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: employer.path, type: "website", siteName: SITE_NAME, locale: "it_IT" },
  };
}

export default async function EmployerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const allJobs = await getJobs();
  const employer = findEmployer(allJobs, slug);
  if (!employer) {
    if (hasAnyJobs(allJobs, slug)) redirect("/aziende");
    notFound();
  }
  const stats = employerStats(employer, allJobs);
  const faq = employerFaq(employer, stats);
  const shown = employer.jobs.slice(0, EMPLOYER_JOBS_SHOWN);

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Aziende", href: "/aziende" },
                { label: employer.name, href: employer.path },
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {employer.name}: offerte di lavoro
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary">
              {stats.count} {stats.count === 1 ? "offerta attiva" : "offerte attive"}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {employerIntro(employer, stats)}
            </p>
            <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Aree con offerte">
              {stats.professions.map((item) =>
                item.href ? (
                  <Link prefetch={false} key={item.label} href={item.href} className="filter-chip">
                    {item.label} · {item.count}
                  </Link>
                ) : (
                  <span key={item.label} className="filter-chip">
                    {item.label} · {item.count}
                  </span>
                ),
              )}
            </nav>
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            <h2 className="section-title">Offerte più recenti</h2>
            {shown.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
            {stats.count > shown.length && (
              <p className="pt-2 text-sm text-muted">
                Mostriamo le {shown.length} offerte più recenti su {stats.count}. Vedi le altre per area:{" "}
                {stats.professions
                  .filter((item) => item.href)
                  .map((item, index, list) => (
                    <span key={item.label}>
                      <Link href={item.href!} className="font-semibold text-primary hover:underline">
                        {item.label}
                      </Link>
                      {index < list.length - 1 ? ", " : "."}
                    </span>
                  ))}
              </p>
            )}

            <section className="pt-8">
              <h2 className="section-title">Domande frequenti</h2>
              <div className="mt-4 space-y-5">
                {faq.map((item) => (
                  <div key={item.q}>
                    <h3 className="font-extrabold">{item.q}</h3>
                    <p className="mt-1 text-sm leading-7 text-muted">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            {stats.districts.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-extrabold">Dove sta assumendo</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {stats.districts.map((item) => (
                    <li key={item.label} className="flex justify-between gap-3">
                      {item.href ? (
                        <Link href={item.href} className="font-semibold hover:text-primary">
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                      <span className="text-muted">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats.salaries.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-extrabold">Retribuzioni pubblicate</h2>
                <p className="mt-1 text-xs text-muted">Mediana mensile nelle offerte che indicano la retribuzione.</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {stats.salaries.map((row) => (
                    <li key={row.profession}>
                      <span className="font-semibold">{row.profession}</span>: {formatMoney(row.median)}
                      <span className="block text-xs text-muted">
                        {formatMoney(row.min)} – {formatMoney(row.max)} · {row.samples} offerte
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
