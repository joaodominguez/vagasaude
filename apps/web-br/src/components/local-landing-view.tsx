import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { CategoryPagination } from "@/components/category-page-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import {
  CATEGORY_PAGE_SIZE,
  buildCategoryStats,
  categoryPath,
  categoryTotalPages,
  isCategoryEligible,
  parentProfession,
  sliceCategoryPage,
} from "@/lib/categories";
import type { Job } from "@/lib/jobs";
import {
  buildLocalIntroText,
  buildLocalItemListJsonLd,
  localNeighbors,
  type LocalRef,
} from "@/lib/local-landings";

/** Landing profissão × cidade; só a `page` atual é renderizada. */
export function LocalLandingView({
  local,
  page = 1,
  allJobs,
}: {
  local: LocalRef;
  page?: number;
  allJobs: Job[];
}) {
  const { city, profession, jobs } = local;
  const stats = buildCategoryStats(jobs);
  const totalPages = categoryTotalPages(jobs.length);
  const pageJobs = sliceCategoryPage(jobs, page);
  const jsonLd = buildLocalItemListJsonLd(local, pageJobs, page, CATEGORY_PAGE_SIZE);
  const { sameProfession, sameCity } = localNeighbors(allJobs, local, 10);
  const parent = parentProfession(profession);
  const baseProfession = parent ?? profession;

  const stateEligible = isCategoryEligible(allJobs, null, city.district);
  const comboEligible = isCategoryEligible(allJobs, profession, city.district);
  const professionEligible = isCategoryEligible(allJobs, profession, null);

  const crumbs: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Vagas", href: "/vagas" },
  ];
  if (stateEligible) crumbs.push({ label: city.district, href: categoryPath(null, city.district) });
  crumbs.push({ label: city.name, href: city.path });
  crumbs.push({ label: profession, href: local.path });
  if (page > 1) crumbs.push({ label: `Página ${page}` });

  const related: Array<{ href: string; label: string }> = [
    { href: city.path, label: `Vagas de saúde em ${city.name}` },
  ];
  if (comboEligible) {
    related.push({
      href: categoryPath(profession, city.district),
      label: `${profession} em ${city.district}`,
    });
  }
  if (professionEligible) {
    related.push({ href: categoryPath(profession, null), label: `${profession} no Brasil` });
  }

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {local.h1}
            </h1>
            {totalPages > 1 && (
              <p className="mt-2 text-sm font-semibold text-muted">
                Página {page} de {totalPages}
              </p>
            )}
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {buildLocalIntroText(allJobs, local)}
            </p>
            <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorias relacionadas">
              {related.map((link) => (
                <Link prefetch={false} key={link.href} href={link.href} className="filter-chip">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {pageJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
            <CategoryPagination basePath={local.path} page={page} totalPages={totalPages} />
          </section>

          <aside className="space-y-4">
            <div className="content-card p-5">
              <h2 className="font-extrabold">Resumo</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {stats.sectorCounts.map((item) => (
                  <div key={item.name} className="flex justify-between gap-3">
                    <dt className="text-muted">{item.name}</dt>
                    <dd className="font-semibold">{item.count}</dd>
                  </div>
                ))}
              </dl>
              {stats.topCompanies.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-extrabold uppercase tracking-wider text-muted">
                    Entidades
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {stats.topCompanies.map((item) => (
                      <li key={item.name} className="flex justify-between gap-2">
                        <span className="truncate">{item.name}</span>
                        <span className="text-muted">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="alert-card">
              <h2 className="flex items-center gap-2 font-extrabold">
                <Bell size={18} /> Alerta desta busca
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Receba novas vagas de {profession.toLowerCase()} em {city.district}.
              </p>
              <div className="mt-4">
                <AlertForm
                  compact
                  defaultDistrict={city.district}
                  defaultProfession={baseProfession}
                />
              </div>
            </div>
          </aside>
        </div>

        {page === 1 && (sameProfession.length > 0 || sameCity.length > 0) && (
          <section className="border-t border-border bg-surface">
            <div className="page-container grid gap-8 py-10 lg:grid-cols-2">
              {sameProfession.length > 0 && (
                <div>
                  <h2 className="text-xl font-extrabold">
                    {profession} em outras cidades de {city.district}
                  </h2>
                  <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {sameProfession.map((item) => (
                      <li key={item.path} className="flex justify-between gap-3">
                        <Link href={item.path} className="font-semibold text-primary hover:underline">
                          {item.city.name}
                        </Link>
                        <span className="text-muted">{item.jobs.length}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sameCity.length > 0 && (
                <div>
                  <h2 className="text-xl font-extrabold">Outras profissões em {city.name}</h2>
                  <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {sameCity.map((item) => (
                      <li key={item.path} className="flex justify-between gap-3">
                        <Link href={item.path} className="font-semibold text-primary hover:underline">
                          {item.profession}
                        </Link>
                        <span className="text-muted">{item.jobs.length}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
