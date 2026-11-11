import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { CategoryPagination } from "@/components/category-page-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import {
  buildCategoryStats,
  categoryPath,
  categoryTotalPages,
  isCategoryEligible,
  sliceCategoryPage,
} from "@/lib/categories";
import {
  buildConcelhoIntro,
  buildConcelhoItemListJsonLd,
  type ConcelhoRef,
  type EligibleConcelho,
} from "@/lib/concelhos";
import type { Job } from "@/lib/jobs";
import { emLocal } from "@/lib/pt-locative";

/** `jobs` = todas as vagas do concelho; só a `page` atual é renderizada. */
export function ConcelhoPageView({
  concelho,
  jobs,
  allJobs,
  siblings,
  page = 1,
}: {
  concelho: ConcelhoRef;
  jobs: Job[];
  allJobs: Job[];
  siblings: EligibleConcelho[];
  page?: number;
}) {
  const stats = buildCategoryStats(jobs);
  const intro = buildConcelhoIntro(concelho, jobs);
  const totalPages = categoryTotalPages(jobs.length);
  const pageJobs = sliceCategoryPage(jobs, page);
  const jsonLd = buildConcelhoItemListJsonLd(concelho, pageJobs, page);
  const districtEligible = isCategoryEligible(allJobs, null, concelho.district);

  const crumbs: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Vagas", href: "/vagas" },
  ];
  if (districtEligible) {
    crumbs.push({
      label: concelho.district,
      href: categoryPath(null, concelho.district),
    });
  }
  crumbs.push({ label: concelho.concelho, href: concelho.path });
  if (page > 1) crumbs.push({ label: `Página ${page}` });

  // Profissões com landing profissão × distrito (ligação interna útil).
  const professionCounts = new Map<string, number>();
  for (const job of jobs) {
    professionCounts.set(job.profession, (professionCounts.get(job.profession) ?? 0) + 1);
  }
  const professionLinks = [...professionCounts.entries()]
    .filter(([name]) => isCategoryEligible(allJobs, name, concelho.district))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {concelho.title}
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary">
              {stats.count} {stats.count === 1 ? "oferta ativa" : "ofertas ativas"}
              {totalPages > 1 && (
                <span className="text-muted">
                  {" "}
                  · página {page} de {totalPages}
                </span>
              )}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">{intro}</p>

            <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorias relacionadas">
              <Link prefetch={false} href="/vagas" className="filter-chip">
                Todas as vagas
              </Link>
              {districtEligible && (
                <Link prefetch={false} href={categoryPath(null, concelho.district)} className="filter-chip">
                  {concelho.district}
                </Link>
              )}
            </nav>
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {pageJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
            <CategoryPagination basePath={concelho.path} page={page} totalPages={totalPages} />
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
                <Bell size={18} /> Alerta de vagas
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recebe novas vagas de saúde {emLocal(concelho.concelho)} e arredores.
              </p>
              <div className="mt-4">
                <AlertForm compact defaultDistrict={concelho.district} defaultProfession="" />
              </div>
            </div>

            {professionLinks.length > 0 && (
              <div className="content-card p-5">
                <h2 className="font-extrabold">Por profissão no distrito</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {professionLinks.map(([name]) => (
                    <li key={name}>
                      <Link
                        href={categoryPath(name, concelho.district)}
                        className="font-semibold text-primary hover:underline"
                      >
                        {name} {emLocal(concelho.district)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {page === 1 && siblings.length > 0 && (
          <section className="border-t border-border bg-surface">
            <div className="page-container py-10">
              <h2 className="text-xl font-extrabold">
                Outros concelhos {concelho.district === "Açores" || concelho.district === "Madeira" ? (concelho.district === "Açores" ? "dos Açores" : "da Madeira") : `do distrito de ${concelho.district}`}
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {siblings.map((item) => (
                  <li key={item.path} className="flex justify-between gap-3">
                    <Link href={item.path} className="font-semibold text-primary hover:underline">
                      {item.concelho}
                    </Link>
                    <span className="text-muted">{item.count}</span>
                  </li>
                ))}
              </ul>
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
