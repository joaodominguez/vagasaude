import Link from "next/link";
import {
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { JobCard } from "@/components/job-card";
import { PortugalJobsMap } from "@/components/portugal-jobs-map";
import { SearchForm } from "@/components/search-form";
import {
  categoryPath,
  isCategoryEligible,
  listCategoryChips,
} from "@/lib/categories";
import { concursosPath, listConcursos } from "@/lib/concursos";
import { getJobs } from "@/lib/jobs-data";
import { professions } from "@/lib/jobs";
import { formatNewsDate, listArticles, newsCategoryLabel, newsPath } from "@/lib/news";
import { buildHomeMetadata } from "@/lib/seo";

// Soft-expire alinhado ao Data Cache de jobs (ingest ≤2 min).
export const revalidate = 120;

export async function generateMetadata() {
  const jobs = await getJobs();
  return buildHomeMetadata(jobs.length);
}

export default async function Home() {
  const jobs = await getJobs();
  const recentJobs = [...jobs]
    .sort((a, b) => {
      const byPublished = b.publishedAt.localeCompare(a.publishedAt);
      if (byPublished !== 0) return byPublished;
      return a.title.localeCompare(b.title, "pt");
    })
    .slice(0, 6);
  const concursos = listConcursos(jobs);
  const latestNews = listArticles().slice(0, 3);
  const districtCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job.district || "Portugal";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  // Todas as landings de profissão e de estado (ligações internas para o Google).
  const categoryChips = listCategoryChips(jobs, Number.POSITIVE_INFINITY);
  const professionCategories = categoryChips.filter((c) => c.kind === "profession");
  const districtCategories = categoryChips.filter((c) => c.kind === "district");

  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="page-container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow">
                <BriefcaseMedical size={15} />
                Emprego em saúde, simplificado
              </span>
              <h1 className="hero-title">
                A tua próxima oportunidade
                <br className="hidden sm:block" /> na saúde começa aqui.
              </h1>
              <p className="hero-copy">
                Todas as vagas de saúde em Portugal num só sítio.
              </p>
            </div>

            <div className="mx-auto mt-9 max-w-5xl">
              <SearchForm />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-xs font-semibold text-muted">
                  Pesquisas populares
                </span>
                {professions.slice(0, 5).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/vagas?profissao=${encodeURIComponent(profession)}`;
                  return (
                    <Link key={profession} href={href} className="filter-chip">
                      {profession}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="page-container py-14 sm:py-18">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <span className="section-kicker">Atualizado diariamente</span>
              <h2 className="section-title">Vagas mais recentes</h2>
            </div>
            <Link
              href="/vagas"
              className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
            >
              Ver todas as vagas <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {recentJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>

          <Link
            href="/vagas"
            className="button button-secondary mt-6 w-full sm:hidden"
          >
            Ver todas as vagas
          </Link>
        </section>

        {concursos.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="section-kicker">Emprego público</span>
                <h2 className="section-title">Concursos abertos</h2>
                <p className="mt-2 text-sm text-muted">
                  {concursos.length}{" "}
                  {concursos.length === 1 ? "procedimento aberto" : "procedimentos abertos"} na BEP, no
                  Diário da República e em unidades de saúde públicas.
                </p>
              </div>
              <Link
                href={concursosPath()}
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Ver todos os concursos <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {concursos.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            <Link href={concursosPath()} className="button button-secondary mt-6 w-full sm:hidden">
              Ver todos os concursos
            </Link>
          </section>
        )}

        {latestNews.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="section-kicker">Mercado de trabalho</span>
                <h2 className="section-title">Últimas notícias</h2>
              </div>
              <Link
                href="/noticias"
                className="hidden items-center gap-1.5 text-sm font-bold text-primary hover:underline sm:flex"
              >
                Todas as notícias <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              {latestNews.map((article) => (
                <article key={article.slug} className="content-card flex min-w-0 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="tag tag-primary">{newsCategoryLabel(article.category)}</span>
                    <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
                  </div>
                  <h3 className="mt-3 font-extrabold leading-snug">
                    <Link href={newsPath(article.slug)} className="hover:text-primary">
                      {article.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>
        )}

        {categoryChips.length > 0 && (
          <section className="page-container pb-14 sm:pb-18">
            <span className="section-kicker">Categorias</span>
            <h2 className="section-title">Explorar por profissão e distrito</h2>
            {professionCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por profissão
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {professionCategories.map((category) => (
                    <Link key={category.path} href={category.path} className="filter-chip">
                      {category.profession}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {districtCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por distrito
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {districtCategories.map((category) => (
                    <Link key={category.path} href={category.path} className="filter-chip">
                      {category.district}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section className="border-y border-border bg-surface">
          <div className="page-container py-14 sm:py-18">
            <div className="mb-8 max-w-2xl">
              <span className="section-kicker">Por localidade</span>
              <h2 className="section-title">Vagas em Portugal</h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
                Descobre onde há mais oportunidades neste momento e salta
                direto para o distrito que te interessa.
              </p>
            </div>
            <PortugalJobsMap counts={districtCounts} total={jobs.length} />
          </div>
        </section>

        <section id="sobre" className="page-container py-14 sm:py-18">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BriefcaseMedical,
                title: "Tudo num só sítio",
                copy: "Reunimos oportunidades do setor público, privado e IPSS.",
              },
              {
                icon: CheckCircle2,
                title: "Vagas atualizadas",
                copy: "Verificamos as fontes regularmente e removemos vagas expiradas.",
              },
              {
                icon: ShieldCheck,
                title: "Candidatura segura",
                copy: "Encaminhamos-te sempre para o site oficial da entidade.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <article key={title} className="feature-card">
                <span className="feature-icon">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 font-extrabold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Partners />
      <Footer />
    </>
  );
}
