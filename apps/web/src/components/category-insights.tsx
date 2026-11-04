import Link from "next/link";
import type { Job } from "@/lib/jobs";
import {
  categoryPath,
  isKnownDistrict,
  isKnownProfession,
  type CategoryRef,
} from "@/lib/categories";
import { articlesForCategory, newsPath } from "@/lib/news";
import { emLocal } from "@/lib/pt-locative";
import { careerForProfession } from "@/lib/salary-tables";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";

const DAY_MS = 86_400_000;

function countBy(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .slice(0, limit);
}

/** Vagas publicadas nos últimos `days` dias (página estática: calculado no build/ISR). */
function countRecentJobs(jobs: Job[], days: number) {
  const since = Date.now() - days * DAY_MS;
  return jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && t >= since;
  }).length;
}

/**
 * Conteúdo próprio da landing (página 1): onde estão as vagas (com links para
 * as landings profissão × distrito), quem recruta, salário de referência e FAQ.
 */
export function CategoryInsights({
  category,
  jobs,
  allCategoryRefs,
}: {
  category: CategoryRef;
  jobs: Job[];
  allCategoryRefs: CategoryRef[];
}) {
  const eligible = new Set(allCategoryRefs.map((ref) => ref.path));
  const salaryCareer = careerForProfession(category.profession);
  const linkIfEligible = (
    profession: string | null,
    district: string | null,
  ) => {
    const path = categoryPath(profession, district);
    return eligible.has(path) ? path : undefined;
  };
  const news = articlesForCategory(category.profession, category.district);
  const recent = countRecentJobs(jobs, 7);
  const withSalary = jobs.filter((job) => job.salary).length;
  const employers = countBy(
    jobs.map((job) => job.company),
    8,
  );
  const what = category.profession
    ? category.profession.toLowerCase()
    : "saúde";
  const where = category.district ? emLocal(category.district) : "em Portugal";

  // Onde estão: profissão → distritos; distrito → profissões; combo → localidades.
  const places =
    category.kind === "profession"
      ? countBy(
          jobs.map((job) => job.district).filter(isKnownDistrict),
          30,
        ).map(([name, count]) => ({
          name,
          count,
          href: linkIfEligible(category.profession, name),
        }))
      : category.kind === "district"
        ? countBy(
            jobs.map((job) => job.profession).filter(isKnownProfession),
            20,
          ).map(([name, count]) => ({
            name,
            count,
            href: linkIfEligible(name, category.district),
          }))
        : countBy(
            jobs.map((job) => job.city),
            15,
          )
            .filter(([, count]) => count >= 2)
            .map(([name, count]) => ({
              name,
              count,
              href: undefined as string | undefined,
            }));
  const placesTitle =
    category.kind === "profession"
      ? `Vagas de ${what} por distrito`
      : category.kind === "district"
        ? `Profissões com vagas ${where}`
        : `Localidades com vagas de ${what} ${where}`;

  const salary =
    category.profession && category.profession !== "Outros"
      ? getSalaryBenchmark(category.profession)
      : null;
  const topEmployers = employers
    .slice(0, 3)
    .map(([name]) => name)
    .join(", ");

  const faq = [
    {
      q: `Quantas vagas de ${what} há ${where}?`,
      a: `Neste momento há ${jobs.length.toLocaleString("pt-PT")} ${jobs.length === 1 ? "vaga activa" : "vagas activas"}${recent ? `, ${recent} ${recent === 1 ? "publicada" : "publicadas"} nos últimos 7 dias` : ""}. A lista é actualizada várias vezes por dia a partir dos sites das próprias entidades.`,
    },
    topEmployers && {
      q: `Quem está a recrutar ${category.profession ? `para ${what}` : "na saúde"} ${where}?`,
      a: `As entidades com mais vagas abertas são ${topEmployers}.`,
    },
    salary && {
      q: `Qual é o salário de referência em ${what}?`,
      a: `A faixa de referência é ${formatEuroRange(salary.low, salary.high)} brutos por mês, com média de ${formatEuro(salary.average)} (estimativa com base nas tabelas públicas e em referências de mercado; não é o salário de cada vaga). ${withSalary ? `${withSalary} ${withSalary === 1 ? "vaga indica" : "vagas indicam"} o salário no anúncio.` : "A maioria dos anúncios não indica o salário."}`,
    },
    {
      q: "Como me candidato?",
      a: "Abre a vaga e carrega em “Candidatar”: a candidatura é feita directamente no site da entidade, sem custos. Também podes criar um alerta para receberes novas vagas por email.",
    },
  ].filter(Boolean) as Array<{ q: string; a: string }>;

  return (
    <section className="border-t border-border bg-surface">
      <div className="page-container grid gap-8 py-10 lg:grid-cols-2">
        <div>
          {places.length > 0 && (
            <>
              <h2 className="text-xl font-extrabold">{placesTitle}</h2>
              <ul className="mb-8 mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {places.map((place) => (
                  <li key={place.name} className="flex justify-between gap-3">
                    {place.href ? (
                      <Link
                        href={place.href}
                        className="font-semibold text-primary hover:underline"
                      >
                        {place.name}
                      </Link>
                    ) : (
                      <span>{place.name}</span>
                    )}
                    <span className="text-muted">{place.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {employers.length > 0 && (
            <>
              <h2 className="text-xl font-extrabold">Quem está a recrutar</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {employers.map(([name, count]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span className="truncate">{name}</span>
                    <span className="text-muted">{count}</span>
                  </li>
                ))}
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
          {news.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-extrabold">Notícias relacionadas</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {news.map((article) => (
                  <li key={article.slug}>
                    <Link href={newsPath(article.slug)} className="font-semibold text-primary hover:underline">
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {salaryCareer && (
            <Link
              href={`/salarios/${salaryCareer.slug}`}
              className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
            >
              Ver a tabela salarial de {salaryCareer.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
