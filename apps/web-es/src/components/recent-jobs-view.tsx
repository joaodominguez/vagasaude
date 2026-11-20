import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryPagination } from "@/components/category-page-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { categoryPath, listCategoryChips } from "@/lib/categories";
import type { Job } from "@/lib/jobs";
import {
  RECENT_PATH,
  buildRecentIntro,
  buildRecentItemListJsonLd,
  recentHeading,
  recentTotalPages,
  sliceRecentPage,
  type RecentSet,
} from "@/lib/recent-jobs";

/** /empleo/hoy: ofertas de las últimas 48 h, 50 por página, con HTML ligero (solo tarjetas y enlaces). */
export function RecentJobsView({
  set,
  page = 1,
  allJobs,
}: {
  set: RecentSet;
  page?: number;
  allJobs: Job[];
}) {
  const totalPages = recentTotalPages(set.jobs.length);
  const pageJobs = sliceRecentPage(set.jobs, page);
  const jsonLd = buildRecentItemListJsonLd(pageJobs, page);
  const chips = listCategoryChips(allJobs, Number.POSITIVE_INFINITY);
  const professions = chips.filter((c) => c.kind === "profession").slice(0, 8);
  const regions = chips.filter((c) => c.kind === "district").slice(0, 10);

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs
              items={[
                { label: "Inicio", href: "/" },
                { label: "Empleo", href: "/empleo" },
                { label: "Ofertas de hoy", href: RECENT_PATH },
                ...(page > 1 ? [{ label: `Página ${page}` }] : []),
              ]}
            />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {recentHeading(set)}
            </h1>
            {totalPages > 1 && (
              <p className="mt-2 text-sm font-semibold text-muted">
                Página {page} de {totalPages}
              </p>
            )}
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {buildRecentIntro(set)}
            </p>
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {pageJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
            <CategoryPagination basePath={RECENT_PATH} page={page} totalPages={totalPages} />
          </section>

          <aside className="space-y-4">
            <div className="alert-card">
              <h2 className="flex items-center gap-2 font-extrabold">
                <Bell size={18} /> Alerta de ofertas nuevas
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recibe por email las ofertas nuevas de tu profesión y comunidad.
              </p>
              <div className="mt-4">
                <AlertForm compact defaultDistrict="" defaultProfession="" />
              </div>
            </div>

            <div className="content-card p-5">
              <h2 className="font-extrabold">Por profesión</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {professions.map((item) => (
                  <li key={item.path}>
                    <Link href={item.path} prefetch={false} className="font-semibold text-primary hover:underline">
                      {item.profession}
                    </Link>
                  </li>
                ))}
              </ul>
              {regions.length > 0 && (
                <>
                  <h2 className="mt-5 font-extrabold">Por comunidad</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {regions.map((item) => (
                      <li key={item.path}>
                        <Link href={item.path} prefetch={false} className="font-semibold text-primary hover:underline">
                          {item.district}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link
                href={categoryPath(null, null)}
                prefetch={false}
                className="mt-5 block text-sm font-bold text-primary hover:underline"
              >
                Ver todas las ofertas →
              </Link>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
