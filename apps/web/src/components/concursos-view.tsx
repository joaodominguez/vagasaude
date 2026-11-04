import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { ConcursosList } from "@/components/concursos-list";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { JOB_TYPE_LABEL } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";
import {
  CONCURSOS_LIST_CAP,
  buildConcursosFaq,
  buildConcursosHeading,
  buildConcursosItemListJsonLd,
  concursosDistricts,
  concursosPath,
  concursosProfessions,
  currentYear,
  filterConcursos,
  listEligibleConcursos,
  professionLower,
  type ConcursoItem,
} from "@/lib/concursos";
import { getArticle, listNewsCategories, newsCategoryPath, newsPath } from "@/lib/news";
import { emLocal } from "@/lib/pt-locative";

const GUIDE_SLUG = "como-ler-aviso-concurso-saude";

/**
 * Hub /concursos e sub-landings /concursos/<profissão>[/<distrito>].
 * `all` = todos os procedimentos abertos; filtra-se aqui por profissão/distrito.
 */
export function ConcursosView({
  all,
  profession,
  district,
}: {
  all: ConcursoItem[];
  profession: string | null;
  district: string | null;
}) {
  const items = filterConcursos(all, profession, district);
  const shown = items.slice(0, CONCURSOS_LIST_CAP);
  const heading = buildConcursosHeading(profession, district);
  const path = concursosPath(profession, district);
  const eligible = new Set(listEligibleConcursos(all).map((ref) => ref.path));
  const year = currentYear();

  // Só se ligam conteúdos publicados (rascunhos ficam de fora).
  const guide = getArticle(GUIDE_SLUG);
  const guideHref = guide && !guide.draft ? newsPath(GUIDE_SLUG) : null;
  const newsHref = listNewsCategories().includes("concursos")
    ? newsCategoryPath("concursos")
    : null;
  const faq = buildConcursosFaq(items, profession, district, { guideHref });

  const crumbs: BreadcrumbItem[] = [{ label: "Início", href: "/" }];
  if (profession) {
    crumbs.push({ label: "Concursos", href: "/concursos" });
    if (district) {
      crumbs.push({ label: profession, href: concursosPath(profession) });
      crumbs.push({ label: district });
    } else {
      crumbs.push({ label: profession });
    }
  } else {
    crumbs.push({ label: "Concursos" });
  }

  const typeCounts = new Map<string, number>();
  for (const { type } of items) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

  // Ligações internas: profissões (hub) ou distritos com landing própria (sub-landing de profissão).
  const professionLinks = !profession
    ? concursosProfessions(all)
        .filter(([name]) => eligible.has(concursosPath(name)))
        .map(([name, count]) => ({ label: name, count, href: concursosPath(name) }))
    : [];
  const districtLinks =
    profession && !district
      ? concursosDistricts(items)
          .filter(([name]) => eligible.has(concursosPath(profession, name)))
          .map(([name, count]) => ({ label: name, count, href: concursosPath(profession, name) }))
      : [];
  const siblingProfessions = profession
    ? concursosProfessions(all)
        .filter(([name]) => name !== profession && eligible.has(concursosPath(name)))
        .map(([name, count]) => ({ label: name, count, href: concursosPath(name) }))
    : [];

  const listItems = shown.map(({ job, type }: { job: Job; type: string }) => ({
    key: job.slug,
    profession: job.profession,
    district: job.district,
    type,
    typeLabel: JOB_TYPE_LABEL[type as keyof typeof JOB_TYPE_LABEL],
    node: <JobCard job={job} />,
  }));

  const what = profession ? `de ${professionLower(profession)}` : "do setor da saúde";
  const where = district ? ` ${emLocal(district)}` : " em Portugal";
  const typeSummary = [...typeCounts.entries()]
    .map(([type, n]) => `${n} ${JOB_TYPE_LABEL[type as keyof typeof JOB_TYPE_LABEL].toLowerCase()}`)
    .join(", ");

  const jsonLd = buildConcursosItemListJsonLd(`${heading} ${year}`, path, items);

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              {heading} {year}
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary">
              {items.length} {items.length === 1 ? "procedimento aberto" : "procedimentos abertos"}
              {typeSummary && <span className="text-muted"> · {typeSummary}</span>}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Concursos, procedimentos concursais, bolsas de recrutamento e outros procedimentos de
              recrutamento público {what}
              {where}, recolhidos da Bolsa de Emprego Público (BEP), do Diário da República (2.ª
              série) e dos sites das entidades de saúde. Cada ficha liga à fonte oficial, onde estão
              o aviso, os requisitos e o prazo de candidatura indicado.
            </p>

            {[
              { title: "Por profissão", links: professionLinks },
              { title: `Concursos ${what} por distrito`, links: districtLinks },
              { title: "Outras profissões", links: siblingProfessions },
            ].map(
              (group) =>
                group.links.length > 0 && (
                  <nav key={group.title} className="mt-5" aria-label={group.title}>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                      {group.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {group.links.map((link) => (
                        <Link key={link.href} href={link.href} className="filter-chip">
                          {link.label} ({link.count})
                        </Link>
                      ))}
                    </div>
                  </nav>
                ),
            )}
          </div>
        </section>

        <div className="page-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {listItems.length > 0 ? (
              <>
                <ConcursosList items={listItems} showProfessionFilter={!profession} />
                {items.length > shown.length && (
                  <p className="mt-4 text-sm text-muted">
                    Mostramos os {shown.length} procedimentos mais recentes de {items.length}. Usa
                    as ligações por profissão e distrito para ver os restantes.
                  </p>
                )}
              </>
            ) : (
              <div className="content-card px-6 py-14 text-center">
                <h2 className="text-xl font-extrabold">
                  Neste momento não há procedimentos abertos
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  Cria um alerta e avisamos-te quando for publicado um concurso ou bolsa de
                  recrutamento.
                </p>
                <Link className="button button-primary mt-6 inline-flex" href="/alertas">
                  Criar alerta
                </Link>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="alert-card">
              <h2 className="flex items-center gap-2 font-extrabold">
                <Bell size={18} /> Avisos de concursos
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recebe por email os novos procedimentos {what}
                {district ? ` ${emLocal(district)}` : ""}.
              </p>
              <div className="mt-4">
                <AlertForm
                  compact
                  defaultDistrict={district ?? ""}
                  defaultProfession={profession ?? ""}
                  defaultSector="Público"
                />
              </div>
            </div>
            <div className="content-card p-5 text-sm leading-6 text-muted">
              <h2 className="font-extrabold text-foreground">Antes de te candidatares</h2>
              <p className="mt-2">
                Lê sempre o aviso oficial: é nele que constam os requisitos, os métodos de seleção
                e o prazo de candidatura de cada procedimento.
              </p>
              {(guideHref || newsHref) && (
                <ul className="mt-3 space-y-1.5">
                  {guideHref && (
                    <li>
                      <Link href={guideHref} className="font-semibold text-primary hover:underline">
                        Como ler um aviso de concurso na saúde
                      </Link>
                    </li>
                  )}
                  {newsHref && (
                    <li>
                      <Link href={newsHref} className="font-semibold text-primary hover:underline">
                        Resumo semanal de concursos
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <section className="border-t border-border bg-surface">
          <div className="page-container py-10">
            <h2 className="text-xl font-extrabold">Perguntas frequentes</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.a}
                    {guideHref && item.q.startsWith("Como se lê") && (
                      <>
                        {" "}
                        <Link href={guideHref} className="font-semibold text-primary hover:underline">
                          Ler o guia
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
