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
  sliceCategoryPage,
} from "@/lib/categories";
import {
  buildCityIntro,
  buildCityItemListJsonLd,
  citiesOfDistrict,
  type CityRef,
} from "@/lib/cities";
import type { Job } from "@/lib/jobs";

/** Landing de cidade /vagas/<estado>/<cidade>; só a `page` atual é renderizada. */
export function CityPageView({
  city,
  page = 1,
  allJobs,
}: {
  city: CityRef;
  page?: number;
  allJobs: Job[];
}) {
  const jobs = city.jobs;
  const stats = buildCategoryStats(jobs);
  const totalPages = categoryTotalPages(jobs.length);
  const pageJobs = sliceCategoryPage(jobs, page);
  const jsonLd = buildCityItemListJsonLd(city, pageJobs, page, CATEGORY_PAGE_SIZE);
  const stateEligible = isCategoryEligible(allJobs, null, city.district);
  const statePath = categoryPath(null, city.district);
  const otherCities = citiesOfDistrict(allJobs, city.district)
    .filter((c) => c.path !== city.path)
    .slice(0, 12);

  const professionCounts = new Map<string, number>();
  for (const job of jobs) {
    if (job.profession === "Outros") continue;
    professionCounts.set(job.profession, (professionCounts.get(job.profession) ?? 0) + 1);
  }
  const professions = [...professionCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .slice(0, 10);

  const crumbs: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Vagas", href: "/vagas" },
  ];
  if (stateEligible) crumbs.push({ label: city.district, href: statePath });
  crumbs.push({ label: city.name, href: city.path });
  if (page > 1) crumbs.push({ label: `Página ${page}` });

  const topEmployers = stats.topCompanies.slice(0, 3).map((c) => c.name).join(", ");
  const faq = [
    {
      q: `Quantas vagas de saúde há em ${city.name}?`,
      a: `Neste momento há ${jobs.length.toLocaleString("pt-BR")} ${jobs.length === 1 ? "vaga ativa" : "vagas ativas"} em ${city.name} (${city.uf}). A lista é atualizada várias vezes por dia a partir dos sites das próprias entidades.`,
    },
    topEmployers && {
      q: `Quem está contratando em ${city.name}?`,
      a: `As entidades com mais vagas abertas são ${topEmployers}.`,
    },
    {
      q: "Como me candidato?",
      a: "Abra a vaga e clique em “Candidate-se”: a candidatura é feita diretamente no site da entidade, sem custos. Você também pode criar um alerta para receber novas vagas por email.",
    },
  ].filter(Boolean) as Array<{ q: string; a: string }>;

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {city.title}
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
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {buildCityIntro(city)}
            </p>
            <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorias relacionadas">
              <Link href="/vagas" className="filter-chip">
                Todas as vagas
              </Link>
              {stateEligible && (
                <Link href={statePath} className="filter-chip">
                  Vagas em {city.district}
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
            <CategoryPagination basePath={city.path} page={page} totalPages={totalPages} />
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
                <Bell size={18} /> Alerta desta cidade
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Receba novas vagas de saúde em {city.district}.
              </p>
              <div className="mt-4">
                <AlertForm compact defaultDistrict={city.district} defaultProfession="" />
              </div>
            </div>

            {otherCities.length > 0 && (
              <div className="content-card p-5">
                <h2 className="font-extrabold">Outras cidades de {city.district}</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {otherCities.map((item) => (
                    <li key={item.path} className="flex justify-between gap-3">
                      <Link href={item.path} className="font-semibold text-primary hover:underline">
                        {item.name}
                      </Link>
                      <span className="text-muted">{item.jobs.length}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {page === 1 && (
          <section className="border-t border-border bg-surface">
            <div className="page-container grid gap-8 py-10 lg:grid-cols-2">
              <div>
                {professions.length > 0 && (
                  <>
                    <h2 className="text-xl font-extrabold">Profissões com vagas em {city.name}</h2>
                    <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {professions.map(([name, count]) => {
                        const href = isCategoryEligible(allJobs, name, city.district)
                          ? categoryPath(name, city.district)
                          : null;
                        return (
                          <li key={name} className="flex justify-between gap-3">
                            {href ? (
                              <Link href={href} className="font-semibold text-primary hover:underline">
                                {name} em {city.district}
                              </Link>
                            ) : (
                              <span>{name}</span>
                            )}
                            <span className="text-muted">{count}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Perguntas frequentes</h2>
                <div className="mt-4 space-y-5">
                  {faq.map((item) => (
                    <div key={item.q}>
                      <h3 className="font-bold">{item.q}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
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
