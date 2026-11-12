import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { listEmployers } from "@/lib/employers";
import { getJobs } from "@/lib/jobs-data";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const employers = listEmployers(await getJobs());
  const title = "Aziende sanitarie che assumono: offerte per datore di lavoro";
  const description = `Ospedali, cliniche, RSA e gruppi sanitari con offerte di lavoro: ${employers.length} datori di lavoro con offerte aggiornate ogni giorno su ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: "/aziende" },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: "/aziende", type: "website", siteName: SITE_NAME, locale: "it_IT" },
  };
}

export default async function EmployersIndexPage() {
  const employers = listEmployers(await getJobs());
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Aziende", href: "/aziende" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Aziende sanitarie che assumono
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {employers.length} ospedali, cliniche, RSA, ottiche e gruppi sanitari con offerte
              attive. Per ogni azienda trovi le offerte attuali, le aree e le regioni in cui
              assume e le retribuzioni pubblicate.
            </p>
          </div>
        </section>
        <div className="page-container py-10">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employers.map((employer) => (
              <li key={employer.slug}>
                <Link
                  href={employer.path}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary"
                >
                  <span className="font-semibold">{employer.name}</span>
                  <span className="shrink-0 text-sm text-muted">{employer.jobs.length} offerte</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
