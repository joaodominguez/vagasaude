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
import {
  ARCHIVE_DAYS,
  employerRegions,
  employerProcedures,
  entityType,
  getEmployerArchive,
  officialJobsLink,
  upcomingDeadlines,
} from "@/lib/employer-info";
import { isPublicJob } from "@/lib/job-type";
import { typeBreakdownText } from "@/lib/concorsi-hubs";
import { displayTitle } from "@/lib/display-title";
import { shortDate } from "@/lib/job-display";
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
  const type = entityType(employer.name, employer.jobs.some(isPublicJob));
  const region = employerRegions(employer.jobs).main;
  const title = `${employer.name}: ${count} ${count === 1 ? "offerta" : "offerte"} di lavoro e concorsi`;
  const description = truncateMeta(
    `${count} ${count === 1 ? "offerta" : "offerte"} di lavoro presso ${employer.name} (${type.short}${region ? `, ${region}` : ""}): bandi aperti, scadenze, archivio dei bandi recenti e link ufficiale. Aggiornato ogni giorno su ${SITE_NAME}.`,
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
  const isPublic = employer.jobs.some(isPublicJob);
  const type = entityType(employer.name, isPublic);
  const regions = employerRegions(employer.jobs);
  const official = officialJobsLink(employer.jobs);
  const archive = await getEmployerArchive(employer.slug);
  const deadlines = upcomingDeadlines(employer.jobs, 30);
  const procedures = employerProcedures(employer.jobs);
  const nextDeadline = deadlines[0];
  faq.splice(
    faq.length - 1,
    0,
    ...(nextDeadline
      ? [
          {
            q: `Quando scade il prossimo bando di ${employer.name}?`,
            a: `Il prossimo a scadere tra quelli aperti è «${displayTitle(nextDeadline.title, nextDeadline)}», il ${shortDate(nextDeadline.expiresAt)}. In totale ${deadlines.length} ${deadlines.length === 1 ? "offerta scade" : "offerte scadono"} nei prossimi 30 giorni. La scadenza è quella indicata dalla fonte: verificala sempre nel bando ufficiale.`,
          },
        ]
      : []),
    ...(archive.total > 0
      ? [
          {
            q: `${employer.name} ha pubblicato altri bandi di recente?`,
            a: `Sì: negli ultimi ${ARCHIVE_DAYS} giorni abbiamo registrato ${archive.total} ${archive.total === 1 ? "bando o offerta ormai scaduto" : "bandi o offerte ormai scaduti"}, elencati nell'archivio di questa pagina (solo titolo, date e collegamento). Sono utili per capire quali profili cerca e con che frequenza.`,
          },
        ]
      : []),
    ...(official
      ? [
          {
            q: `Dove trovo il sito ufficiale per candidarmi a ${employer.name}?`,
            a: `${official.label}: ${official.url}. Le candidature si inviano sempre sul canale ufficiale indicato dal bando o dall'annuncio.`,
          },
        ]
      : []),
  );
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
              {deadlines.length > 0 ? ` · ${deadlines.length} in scadenza entro 30 giorni` : ""}
            </p>
            <p className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="tag tag-primary">{type.short}</span>
              <span className="tag">{isPublic ? "Ente pubblico" : "Privato"}</span>
              {regions.main && (
                <span className="tag">
                  {regions.count > 1 ? `${regions.main} e altre ${regions.count - 1} regioni` : regions.main}
                </span>
              )}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {employerIntro(employer, stats)} Tipo di ente: {type.label}.
              {procedures.length > 0 ? ` Procedure aperte: ${typeBreakdownText(procedures)}.` : ""}
            </p>
            {official && (
              <p className="mt-3 text-sm">
                <a href={official.url} rel="noopener nofollow" target="_blank" className="font-semibold text-primary hover:underline">
                  {official.label} →
                </a>
              </p>
            )}
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

            {archive.items.length > 0 && (
              <section className="pt-8" id="archivio">
                <h2 className="section-title">Archivio: bandi scaduti di recente</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Bandi e offerte di {employer.name} chiusi negli ultimi {ARCHIVE_DAYS} giorni
                  {archive.total > archive.items.length ? ` (ultimi ${archive.items.length} su ${archive.total})` : ""}. Non
                  sono più aperti alle candidature.
                </p>
                <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
                  {archive.items.map((item) => (
                    <li key={item.slug} className="px-4 py-3">
                      <Link href={`/offerte/${item.slug}`} prefetch={false} className="font-semibold hover:text-primary">
                        {item.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.kind}
                        {item.publishedAt && shortDate(item.publishedAt) ? ` · pubblicato il ${shortDate(item.publishedAt)}` : ""}
                        {item.closedAt && shortDate(item.closedAt) ? ` · chiuso il ${shortDate(item.closedAt)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
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
            {deadlines.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-extrabold">Prossime scadenze</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {deadlines.slice(0, 5).map((job) => (
                    <li key={job.slug}>
                      <Link href={`/offerte/${job.slug}`} prefetch={false} className="font-semibold hover:text-primary">
                        {displayTitle(job.title, job)}
                      </Link>
                      <span className="block text-xs text-muted">Scade il {shortDate(job.expiresAt)}</span>
                    </li>
                  ))}
                </ul>
                {isPublic && (
                  <p className="mt-3 text-xs">
                    <Link href="/concorsi/in-scadenza" className="font-semibold text-primary hover:underline">
                      Tutti i concorsi in scadenza
                    </Link>
                  </p>
                )}
              </div>
            )}
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
