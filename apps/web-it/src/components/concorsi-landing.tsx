import Link from "next/link";
import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import type { ConcorsoItem } from "@/lib/concorsi";

export type LandingLink = { label: string; href: string; count?: number };
export type LandingSection = { id: string; title: string; note?: string; node: ReactNode };

/**
 * Struttura comune delle landing di /concorsi (in scadenza, per tipo) e degli hub perenni:
 * intestazione con testo introduttivo, gruppi di link, sezioni di schede, FAQ in HTML semplice.
 */
export function ConcorsiLanding({
  crumbs,
  h1,
  subline,
  intro,
  chipGroups = [],
  sections,
  faq,
  alert,
  related = [],
  jsonLd = [],
}: {
  crumbs: BreadcrumbItem[];
  h1: string;
  subline?: string;
  intro: string[];
  chipGroups?: Array<{ title: string; links: LandingLink[] }>;
  sections: LandingSection[];
  faq: Array<{ q: string; a: ReactNode }>;
  alert?: { profession?: string | null; district?: string | null; text: string };
  related?: Array<{ title: string; links: LandingLink[] }>;
  jsonLd?: object[];
}) {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">{h1}</h1>
            {subline && <p className="mt-2 text-sm font-semibold text-primary">{subline}</p>}
            {intro.map((text) => (
              <p key={text.slice(0, 40)} className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                {text}
              </p>
            ))}
            {chipGroups.map(
              (group) =>
                group.links.length > 0 && (
                  <nav key={group.title} className="mt-5" aria-label={group.title}>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">{group.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {group.links.map((link) => (
                        <Link prefetch={false} key={link.href} href={link.href} className="filter-chip">
                          {link.label}
                          {link.count !== undefined ? ` (${link.count})` : ""}
                        </Link>
                      ))}
                    </div>
                  </nav>
                ),
            )}
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-[-0.03em]">{section.title}</h2>
                {section.note && <p className="mt-1 text-sm leading-6 text-muted">{section.note}</p>}
                <div className="mt-4">{section.node}</div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            {alert && (
              <div className="alert-card">
                <h2 className="flex items-center gap-2 font-extrabold">
                  <Bell size={18} /> Avvisi sui concorsi
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">{alert.text}</p>
                <div className="mt-4">
                  <AlertForm
                    compact
                    defaultDistrict={alert.district ?? ""}
                    defaultProfession={alert.profession ?? ""}
                    defaultSector="Pubblico"
                  />
                </div>
              </div>
            )}
            {related.map(
              (group) =>
                group.links.length > 0 && (
                  <div key={group.title} className="content-card p-5">
                    <h2 className="font-extrabold">{group.title}</h2>
                    <ul className="mt-3 space-y-2 text-sm">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} className="font-semibold text-primary hover:underline">
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </aside>
        </div>

        <section className="border-t border-border bg-surface">
          <div className="page-container py-10">
            <h2 className="text-xl font-extrabold">Domande frequenti</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      {jsonLd.map((data, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      ))}
    </>
  );
}

export function CardList({ items, empty }: { items: ConcorsoItem[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  return (
    <div className="min-w-0 space-y-3">
      {items.map(({ job }) => (
        <JobCard key={job.slug} job={job} />
      ))}
    </div>
  );
}
