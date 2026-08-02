import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import type { Job } from "@/lib/jobs";
import {
  buildCategoryIntro,
  buildCategoryStats,
  buildItemListJsonLd,
  categoryPath,
  relatedCategoryLinks,
  siblingDistrictLinks,
  type CategoryRef,
} from "@/lib/categories";

export function CategoryPageView({
  ref,
  jobs,
  allCategoryRefs,
}: {
  ref: CategoryRef;
  jobs: Job[];
  allCategoryRefs: CategoryRef[];
}) {
  const stats = buildCategoryStats(jobs);
  const intro = buildCategoryIntro(stats, ref.profession, ref.district);
  const related = relatedCategoryLinks(allCategoryRefs, ref);
  const siblings = siblingDistrictLinks(allCategoryRefs, ref);
  const jsonLd = buildItemListJsonLd(ref, jobs);

  const parentLinks: Array<{ href: string; label: string }> = [
    { href: "/vagas", label: "Todas as vagas" },
  ];
  if (ref.kind === "combo" && ref.profession) {
    parentLinks.push({
      href: categoryPath(ref.profession, null),
      label: ref.profession,
    });
  }
  if (ref.kind === "combo" && ref.district) {
    parentLinks.push({
      href: categoryPath(null, ref.district),
      label: ref.district,
    });
  }

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Link
              href="/vagas"
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary"
            >
              <ArrowLeft size={16} /> Voltar às vagas
            </Link>
            <p className="section-kicker">Categoria</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {ref.title}
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary">
              {stats.count}{" "}
              {stats.count === 1 ? "oferta activa" : "ofertas activas"}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {intro}
            </p>

            {parentLinks.length > 1 && (
              <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Categorias relacionadas">
                {parentLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="filter-chip">
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
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
                <Bell size={18} /> Alerta desta categoria
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recebe novas{" "}
                {ref.profession
                  ? `vagas de ${ref.profession.toLowerCase()}`
                  : "vagas de saúde"}
                {ref.district ? ` em ${ref.district}` : ""}.
              </p>
              <div className="mt-4">
                <AlertForm
                  compact
                  defaultDistrict={ref.district ?? ""}
                  defaultProfession={ref.profession ?? ""}
                />
              </div>
            </div>

            {(siblings.length > 0 || related.length > 0) && (
              <div className="content-card p-5">
                <h2 className="font-extrabold">Explorar também</h2>
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
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
