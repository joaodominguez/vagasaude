import Link from "next/link";
import { ArrowRight, BriefcaseMedical } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { AlertForm } from "@/components/alert-form";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { JobIcon } from "@/components/profession-icon";
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
import { freshnessLabel, homePaths, listHomeAreas } from "@/lib/home-sections";
import { employerPath } from "@/lib/employers";
import { listRecentJobs, RECENT_PATH } from "@/lib/recent-jobs";

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
  const todaySet = listRecentJobs(jobs);
  const concursos = listConcursos(jobs);
  const latestNews = listArticles().slice(0, 3);
  const districtCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job.district || "Portugal";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  // Todas as landings de profissão e de distrito (ligações internas para o Google).
  const categoryChips = listCategoryChips(jobs, Number.POSITIVE_INFINITY);
  const professionCategories = categoryChips.filter((c) => c.kind === "profession");
  const districtCategories = categoryChips.filter((c) => c.kind === "district");
  const areas = listHomeAreas(jobs);
  const { publicPath, privatePath } = homePaths(jobs);
  const sourceCount = new Set(jobs.map((job) => job.source).filter(Boolean)).size;
  const freshness = freshnessLabel(jobs);
  // Espaço inseparável nos milhares («3 097»): o pt-PT do Intl não agrupa números de 4 dígitos.
  const nf = { format: (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") };

  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="page-container relative z-10">
            <div className="mx-auto max-w-4xl text-center">
              <span className="eyebrow">
                <BriefcaseMedical size={15} />
                Emprego em saúde, simplificado
              </span>
              <h1 className="hero-title">
                A tua próxima vaga
                <br className="hidden sm:block" /> na <b>saúde</b> começa aqui.
              </h1>
              <p className="hero-copy">
                Todas as vagas de saúde em Portugal num só sítio.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-[52rem]">
              <SearchForm />
              {jobs.length > 0 && (
                <p className="trust-line" aria-label="O site em números">
                  <span>
                    <b>{nf.format(jobs.length)}</b> vagas ativas
                  </span>
                  {sourceCount > 1 && (
                    <span>
                      <b>{sourceCount}</b> fontes, do SNS à CUF
                    </span>
                  )}
                  {freshness && <span className="live-dot">{freshness}</span>}
                </p>
              )}
              <nav className="popular-links" aria-label="Pesquisas populares">
                {professions.slice(0, 6).map((profession) => {
                  const href = isCategoryEligible(jobs, profession, null)
                    ? categoryPath(profession, null)
                    : `/vagas?profissao=${encodeURIComponent(profession)}`;
                  return (
                    <Link prefetch={false} key={profession} href={href}>
                      {profession}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </section>

        {areas.length > 0 && (
          <section className="page-container pt-14 sm:pt-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Por área</span>
                <h2 className="section-title">Que área procuras?</h2>
              </div>
              <Link href="/vagas" className="home-more">
                Todas as profissões <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="area-grid">
              {areas.map((area) => (
                <Link key={area.key} href={area.href} className="area-card" prefetch={false}>
                  <JobIcon profession={area.iconProfession} />
                  <span className="min-w-0">
                    <strong>{area.label}</strong>
                    <span className="area-count">
                      {nf.format(area.count)} {area.count === 1 ? "vaga" : "vagas"}
                    </span>
                    <span className="area-desc">{area.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="page-container py-14 sm:py-16">
          <div className="home-head">
            <div>
              <span className="section-kicker">Atualizado diariamente</span>
              <h2 className="section-title">Vagas mais recentes</h2>
            </div>
            <Link href={RECENT_PATH} className="home-more">
              {todaySet.hours <= 48
                ? `Ver as ${nf.format(todaySet.jobs.length)} vagas de hoje`
                : `Ver as ${nf.format(todaySet.jobs.length)} vagas mais recentes`}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {recentJobs.length > 0 ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {recentJobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          ) : (
            <div className="content-card px-6 py-12 text-center">
              <h3 className="text-lg font-extrabold">A reunir as primeiras vagas</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Neste momento não há vagas publicadas. Cria um alerta e escrevemos-te assim que
                chegarem as primeiras.
              </p>
              <Link className="button button-primary mt-6 inline-flex" href="/alertas">
                Criar alerta
              </Link>
            </div>
          )}
          <p className="mt-5 text-sm">
            <Link href="/vagas" className="home-more">
              Ver todas as {nf.format(jobs.length)} vagas <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </section>

        <section id="alertas" className="page-container pb-14 sm:pb-16">
          <div className="alert-band">
            <div>
              <span className="alert-band-kicker">Alertas grátis</span>
              <h2>Recebe as novas vagas antes de toda a gente</h2>
              <p>
                Escolhe a profissão e o distrito. Enviamos no máximo 2 emails por dia, e podes
                cancelar com um clique.
              </p>
              <SocialAlertLinks onDark className="mt-3" />
            </div>
            <AlertForm band />
          </div>
        </section>

        {jobs.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Por distrito</span>
                <h2 className="section-title">Vagas em Portugal</h2>
              </div>
              <Link href="/vagas" className="home-more">
                Ver todos os distritos <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <PortugalJobsMap counts={districtCounts} total={jobs.length} />
          </section>
        )}

        {jobs.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Público ou privado</span>
                <h2 className="section-title">Dois caminhos na saúde</h2>
              </div>
            </div>
            <div className="paths-grid">
              <div className="path-card">
                <h3>
                  SNS e setor público <span>{nf.format(publicPath.count)} vagas</span>
                </h3>
                <p>Concursos, bolsas de recrutamento e mobilidades das ULS, IPO, INEM e institutos públicos de saúde.</p>
                {publicPath.employers.length > 0 && (
                  <div className="mini-list">
                    {publicPath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href={concursosPath()} className="home-more">
                  Ver concursos abertos <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="path-card">
                <h3>
                  Privado e social <span>{nf.format(privatePath.count)} vagas</span>
                </h3>
                <p>Hospitais e clínicas privadas, clínicas dentárias, farmácias, lares e IPSS.</p>
                {privatePath.employers.length > 0 && (
                  <div className="mini-list">
                    {privatePath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/empresas" className="home-more">
                  Ver todas as entidades <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {concursos.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Emprego público</span>
                <h2 className="section-title">Concursos abertos</h2>
                <p className="mt-2 text-sm text-muted">
                  {concursos.length}{" "}
                  {concursos.length === 1 ? "procedimento aberto" : "procedimentos abertos"} na BEP, no
                  Diário da República e em unidades de saúde públicas.
                </p>
              </div>
              <Link href={concursosPath()} className="home-more">
                Ver todos os concursos <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {concursos.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          </section>
        )}

        {latestNews.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Mercado de trabalho</span>
                <h2 className="section-title">Últimas notícias</h2>
              </div>
              <Link href="/noticias" className="home-more">
                Todas as notícias <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="news-grid">
              {latestNews.map((article) => (
                <Link key={article.slug} href={newsPath(article.slug)} prefetch={false}>
                  <small>
                    {newsCategoryLabel(article.category)} ·{" "}
                    <time dateTime={article.date}>{formatNewsDate(article.date)}</time>
                  </small>
                  <strong>{article.title}</strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        {categoryChips.length > 0 && (
          <section id="sobre" className="page-container pb-14 sm:pb-16">
            <span className="section-kicker">Categorias</span>
            <h2 className="section-title">Explorar por profissão e distrito</h2>
            {professionCategories.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por profissão
                </h3>
                <div className="explore-links">
                  {professionCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path}>
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
                <div className="explore-links">
                  {districtCategories.map((category) => (
                    <Link prefetch={false} key={category.path} href={category.path}>
                      {category.district}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <Partners />
      <Footer />
    </>
  );
}
