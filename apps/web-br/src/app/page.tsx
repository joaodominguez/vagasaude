import Link from "next/link";
import {
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Partners } from "@/components/partners";
import { JobCard } from "@/components/job-card";
import { JobIcon } from "@/components/profession-icon";
import { SocialAlertLinks } from "@/components/social-alert-links";
import { BrazilJobsMap } from "@/components/brazil-jobs-map";
import { SearchForm } from "@/components/search-form";
import {
  categoryPath,
  isCategoryEligible,
  listCategoryChips,
} from "@/lib/categories";
import { listEligibleCities } from "@/lib/cities";
import {
  concursosPath,
  concursosProfessions,
  listConcursos,
  listEligibleConcursos,
} from "@/lib/concursos-hub";
import { getListingJobs } from "@/lib/jobs-data";
import { isSitemapJob } from "@/lib/indexable";
import { listRecentJobs, RECENT_PATH } from "@/lib/recent-jobs";
import { professions } from "@/lib/jobs";
import { formatNewsDate, listArticles, newsCategoryLabel, newsPath } from "@/lib/news";
import { buildHomeMetadata } from "@/lib/seo";
import { employerPath } from "@/lib/employers";
import { freshnessLabel, homePaths, listHomeAreas } from "@/lib/home-sections";

// ISR homepage; dados vêm do cache em memória do job-store (ingest ≤~2 min).
export const revalidate = 120;

export async function generateMetadata() {
  const jobs = await getListingJobs();
  return buildHomeMetadata(jobs.length);
}

export default async function Home() {
  const jobs = await getListingJobs();
  // Só vagas indexáveis (as do jobs.xml), mais recentes primeiro: ligações diretas para o Googlebot.
  const recentJobs = jobs.filter((job) => isSitemapJob(job)).slice(0, 12);
  const todaySet = listRecentJobs(jobs);
  const latestNews = listArticles().slice(0, 3);
  const districtCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const key = job.district || "Brasil";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  // Todas as landings de profissão e de estado (ligações internas para o Google).
  const categoryChips = listCategoryChips(jobs, Number.POSITIVE_INFINITY);
  const professionCategories = categoryChips.filter((c) => c.kind === "profession");
  const districtCategories = categoryChips.filter((c) => c.kind === "district");

  const topCities = listEligibleCities(jobs).slice(0, 16);
  const concursos = listConcursos(jobs);
  const concursoPaths = new Set(listEligibleConcursos(concursos).map((ref) => ref.path));
  const concursoProfessions = concursosProfessions(concursos)
    .filter(([name]) => concursoPaths.has(concursosPath(name)))
    .slice(0, 8);

  const areas = listHomeAreas(jobs);
  const { publicPath, privatePath } = homePaths(jobs);
  const sourceCount = new Set(jobs.map((job) => job.source).filter(Boolean)).size;
  const freshness = freshnessLabel(jobs);
  const nf = new Intl.NumberFormat("pt-BR");

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
                Sua próxima oportunidade
                <br className="hidden sm:block" /> na <b>saúde</b> começa aqui.
              </h1>
              <p className="hero-copy">
                Todas as vagas de saúde no Brasil em um só site.
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
                      <b>{sourceCount}</b> fontes, de concursos públicos a redes hospitalares
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
                <h2 className="section-title">Que área você procura?</h2>
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

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {recentJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
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
              <h2>Receba as novas vagas antes de todo mundo</h2>
              <p>
                Escolha a profissão e o estado. Enviamos no máximo 2 e-mails por dia e você pode
                cancelar com um clique.
              </p>
              <SocialAlertLinks onDark className="mt-3" />
            </div>
            <AlertForm band />
          </div>
        </section>

        <section className="page-container pb-14 sm:pb-16">
          <div className="home-head">
            <div>
              <span className="section-kicker">Por localidade</span>
              <h2 className="section-title">Vagas no Brasil</h2>
            </div>
            <Link href="/vagas" className="home-more">
              Todos os estados <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <BrazilJobsMap counts={districtCounts} total={jobs.length} />
        </section>

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
                  SUS e setor público <span>{nf.format(publicPath.count)} vagas</span>
                </h3>
                <p>Concursos, processos seletivos e contratações de prefeituras, secretarias e hospitais públicos.</p>
                {publicPath.employers.length > 0 && (
                  <div className="mini-list">
                    {publicPath.employers.map((employer) => (
                      <Link prefetch={false} key={employer.slug} href={employerPath(employer.slug)}>
                        {employer.name} <span>{employer.jobs.length}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/concursos" className="home-more">
                  Ver os concursos abertos <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="path-card">
                <h3>
                  Privado e filantrópico <span>{nf.format(privatePath.count)} vagas</span>
                </h3>
                <p>Hospitais e redes privadas, clínicas, laboratórios, farmácias e instituições filantrópicas.</p>
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
                  Ver todas as empresas <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {concursos.length > 0 && (
          <section className="page-container pb-14 sm:pb-16">
            <div className="home-head">
              <div>
                <span className="section-kicker">Setor público</span>
                <h2 className="section-title">Concursos e processos seletivos</h2>
                <p className="mt-2 text-sm text-muted">
                  {concursos.length} {concursos.length === 1 ? "edital aberto" : "editais abertos"}{" "}
                  na área da saúde, com link para o edital.
                </p>
              </div>
              <Link href="/concursos" className="home-more">
                Ver concursos <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {concursos.slice(0, 4).map(({ job }) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            <div className="explore-links mt-5">
              {concursoProfessions.map(([name, count]) => (
                <Link prefetch={false} key={name} href={concursosPath(name)}>
                  {name} ({count})
                </Link>
              ))}
              <Link prefetch={false} href="/concursos">
                Todos os concursos
              </Link>
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
          <section className="page-container pb-14 sm:pb-16">
            <span className="section-kicker">Categorias</span>
            <h2 className="section-title">Explorar por profissão e estado</h2>
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
                  Por estado
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
            {topCities.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wider text-muted">
                  Por cidade
                </h3>
                <div className="explore-links">
                  {topCities.map((city) => (
                    <Link prefetch={false} key={city.path} href={city.path}>
                      {city.name} ({city.uf})
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section id="sobre" className="page-container pb-14 sm:pb-16">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BriefcaseMedical,
                title: "Tudo em um só site",
                copy: "Reunimos oportunidades do setor público, privado e filantrópico.",
              },
              {
                icon: CheckCircle2,
                title: "Vagas atualizadas",
                copy: "Verificamos as fontes regularmente e removemos vagas expiradas.",
              },
              {
                icon: ShieldCheck,
                title: "Candidatura segura",
                copy: "Encaminhamos você sempre para o site oficial da entidade.",
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

        <section className="border-t border-border bg-surface">
          <div className="page-container flex flex-col gap-4 py-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <span className="section-kicker">Guias</span>
              <h2 className="section-title">Antes de se candidatar</h2>
              <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
                Currículo, carta de apresentação, editais de concurso e
                alertas — textos curtos para quem busca emprego em saúde no
                Brasil.
              </p>
            </div>
            <Link href="/noticias/categoria/guias" className="button button-secondary shrink-0">
              Ver guias <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <Partners />
      <Footer />
    </>
  );
}
