import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { GuideCta } from "@/components/guide-cta";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { CategoryInsights } from "@/components/category-insights";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import type { Job } from "@/lib/jobs";
import {
  buildCategoryIntro,
  buildCategoryStats,
  buildItemListJsonLd,
  categoryPagePath,
  categoryPath,
  categoryTotalPages,
  provinceLinks,
  relatedCategoryLinks,
  siblingDistrictLinks,
  sliceCategoryPage,
  type CategoryRef,
} from "@/lib/categories";
import { inRegione } from "@/lib/it-locative";

/** `jobs` = tutte le offerte della categoria; viene renderizzata solo la `page` corrente. */
export function CategoryPageView({
  category,
  jobs,
  page = 1,
  allCategoryRefs,
}: {
  category: CategoryRef;
  jobs: Job[];
  page?: number;
  allCategoryRefs: CategoryRef[];
}) {
  const stats = buildCategoryStats(jobs);
  const intro = buildCategoryIntro(
    stats,
    category.profession,
    category.province ?? category.district,
  );
  const related = relatedCategoryLinks(allCategoryRefs, category);
  const siblings = siblingDistrictLinks(allCategoryRefs, category);
  const provinces = provinceLinks(allCategoryRefs, category);
  const totalPages = categoryTotalPages(jobs.length);
  const pageJobs = sliceCategoryPage(jobs, page);
  const jsonLd = buildItemListJsonLd(category, pageJobs, page);

  const parentLinks: Array<{ href: string; label: string }> = [
    { href: "/offerte", label: "Tutte le offerte" },
  ];
  if (category.kind === "combo" && category.profession) {
    parentLinks.push({
      href: categoryPath(category.profession, null),
      label: category.profession,
    });
  }
  if (category.kind === "combo" && category.district) {
    parentLinks.push({
      href: categoryPath(null, category.district),
      label: category.district,
    });
  }

  if (category.kind === "province" && category.district) {
    parentLinks.push({
      href: categoryPath(null, category.district),
      label: category.district,
    });
  }

  const crumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Offerte", href: "/offerte" },
  ];
  if (category.kind === "province" && category.district) {
    crumbs.push({
      label: category.district,
      href: categoryPath(null, category.district),
    });
  }
  if (category.kind === "combo" && category.profession) {
    crumbs.push({
      label: category.profession,
      href: categoryPath(category.profession, null),
    });
  }
  crumbs.push({ label: category.title, href: category.path });
  if (page > 1) crumbs.push({ label: `Pagina ${page}` });

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {category.title}
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary">
              {stats.count}{" "}
              {stats.count === 1 ? "offerta attiva" : "offerte attive"}
              {totalPages > 1 && (
                <span className="text-muted">
                  {" "}
                  · pagina {page} di {totalPages}
                </span>
              )}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {intro}
            </p>

            {parentLinks.length > 1 && (
              <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorie correlate">
                {parentLinks.map((link) => (
                  <Link prefetch={false} key={link.href} href={link.href} className="filter-chip">
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {provinces.length > 0 && (
              <nav className="mt-5" aria-label="Per provincia">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                  {category.kind === "district"
                    ? "Per provincia"
                    : `Altre province: ${category.district}`}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {provinces.map((item) => (
                    <Link prefetch={false} key={item.path} href={item.path} className="filter-chip">
                      {item.province}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {pageJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
            <CategoryPagination
              basePath={category.path}
              page={page}
              totalPages={totalPages}
            />
          </section>

          <aside className="space-y-4">
            <div className="content-card p-5">
              <h2 className="font-extrabold">Riepilogo</h2>
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
                    Enti
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
                <Bell size={18} /> Avviso per questa categoria
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Ricevi le nuove{" "}
                {category.profession
                  ? `offerte di ${category.profession.toLowerCase()}`
                  : "offerte di lavoro nella sanità"}
                {category.province
                  ? ` ${inRegione(category.province)}`
                  : category.district
                    ? ` ${inRegione(category.district)}`
                    : ""}.
              </p>
              <div className="mt-4">
                <AlertForm
                  compact
                  defaultDistrict={category.district ?? ""}
                  defaultProfession={category.profession ?? ""}
                />
              </div>
            </div>

            <GuideCta profession={category.profession ?? undefined} />

            {(siblings.length > 0 || related.length > 0) && (
              <div className="content-card p-5">
                <h2 className="font-extrabold">Esplora anche</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {(siblings.length > 0 ? siblings : related).map((item) => (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        className="font-semibold text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
        {page === 1 && (
          <CategoryInsights
            category={category}
            jobs={jobs}
            allCategoryRefs={allCategoryRefs}
          />
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

/** Finestra di numeri attorno alla pagina corrente, con la prima e l'ultima sempre visibili. */
function paginationWindow(page: number, totalPages: number) {
  const pages = new Set([1, totalPages]);
  for (let n = page - 2; n <= page + 2; n += 1) {
    if (n >= 1 && n <= totalPages) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

function CategoryPagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const numbers = paginationWindow(page, totalPages);
  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 pt-6 text-sm"
      aria-label="Paginazione"
    >
      {page > 1 && (
        <Link prefetch={false}
          href={categoryPagePath(basePath, page - 1)}
          className="filter-chip inline-flex items-center gap-1"
          rel="prev"
        >
          <ChevronLeft size={16} /> Precedente
        </Link>
      )}
      {numbers.map((n, index) => (
        <span key={n} className="inline-flex items-center gap-2">
          {index > 0 && n - numbers[index - 1] > 1 && (
            <span className="text-muted" aria-hidden="true">
              …
            </span>
          )}
          {n === page ? (
            <span className="filter-chip font-extrabold" aria-current="page">
              {n}
            </span>
          ) : (
            <Link prefetch={false} href={categoryPagePath(basePath, n)} className="filter-chip">
              {n}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages && (
        <Link prefetch={false}
          href={categoryPagePath(basePath, page + 1)}
          className="filter-chip inline-flex items-center gap-1"
          rel="next"
        >
          Successiva <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
