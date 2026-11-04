import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { GuiasCta } from "@/components/guias-cta";
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
import { enLugar } from "@/lib/es-locative";

/** `jobs` = todas las ofertas de la categoría; solo se renderiza la `page` actual. */
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
    { href: "/empleo", label: "Todas las ofertas" },
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
    { label: "Inicio", href: "/" },
    { label: "Empleo", href: "/empleo" },
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
  if (page > 1) crumbs.push({ label: `Página ${page}` });

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
              {stats.count === 1 ? "oferta activa" : "ofertas activas"}
              {totalPages > 1 && (
                <span className="text-muted">
                  {" "}
                  · página {page} de {totalPages}
                </span>
              )}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {intro}
            </p>

            {parentLinks.length > 1 && (
              <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorías relacionadas">
                {parentLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="filter-chip">
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {provinces.length > 0 && (
              <nav className="mt-5" aria-label="Por provincia">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                  {category.kind === "district"
                    ? "Por provincia"
                    : `Otras provincias de ${category.district}`}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {provinces.map((item) => (
                    <Link key={item.path} href={item.path} className="filter-chip">
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
              <h2 className="font-extrabold">Resumen</h2>
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
                <Bell size={18} /> Alerta de esta categoría
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recibe nuevas{" "}
                {category.profession
                  ? `ofertas de ${category.profession.toLowerCase()}`
                  : "ofertas de empleo sanitario"}
                {category.province
                  ? ` ${enLugar(category.province)}`
                  : category.district
                    ? ` ${enLugar(category.district)}`
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

            <GuiasCta profession={category.profession ?? undefined} />

            {(siblings.length > 0 || related.length > 0) && (
              <div className="content-card p-5">
                <h2 className="font-extrabold">Explorar también</h2>
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

/** Ventana de números alrededor de la página actual, con 1 y la última siempre visibles. */
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
      aria-label="Paginación"
    >
      {page > 1 && (
        <Link
          href={categoryPagePath(basePath, page - 1)}
          className="filter-chip inline-flex items-center gap-1"
          rel="prev"
        >
          <ChevronLeft size={16} /> Anterior
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
            <Link href={categoryPagePath(basePath, n)} className="filter-chip">
              {n}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages && (
        <Link
          href={categoryPagePath(basePath, page + 1)}
          className="filter-chip inline-flex items-center gap-1"
          rel="next"
        >
          Siguiente <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
