import Link from "next/link";
import type { Job } from "@/lib/jobs";
import {
  categoryPath,
  isKnownDistrict,
  isKnownProfession,
  type CategoryRef,
} from "@/lib/categories";
import { articlesForCategory, newsPath } from "@/lib/news";
import { inRegione } from "@/lib/it-locative";
import { isConcorsoJob } from "@/lib/job-type";
import { concorsiPath } from "@/lib/concorsi";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";
import { careerForProfession } from "@/lib/salary-tables";

const DAY_MS = 86_400_000;

const professionLabel = (profession: string) =>
  profession === "OSS" ? "OSS" : profession.toLowerCase();

function countBy(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"))
    .slice(0, limit);
}

/** Offerte pubblicate negli ultimi `days` giorni (pagina statica: calcolato in build/ISR). */
function countRecentJobs(jobs: Job[], days: number) {
  const since = Date.now() - days * DAY_MS;
  return jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && t >= since;
  }).length;
}

/**
 * Contenuto proprio della landing (pagina 1): dove si trovano le offerte (con link
 * alle landing professione × regione), chi assume, retribuzione di riferimento e FAQ.
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
    : "sanitarie";
  const where = category.province
    ? inRegione(category.province)
    : category.district
      ? inRegione(category.district)
      : "in Italia";

  // Dove sono: professione → regioni; regione → professioni; combo → località.
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
      ? `Offerte di ${what} per regione`
      : category.kind === "district"
        ? `Professioni con offerte ${where}`
        : category.kind === "province"
        ? `Località con offerte ${where}`
        : `Località con offerte di ${what} ${where}`;

  const salary =
    category.profession && category.profession !== "Altro"
      ? getSalaryBenchmark(category.profession)
      : null;
  const salaryCareer = careerForProfession(category.profession ?? null);
  const concorsiCount =
    category.kind === "profession" && category.profession
      ? jobs.filter(isConcorsoJob).length
      : 0;
  const topEmployers = employers
    .slice(0, 3)
    .map(([name]) => name)
    .join(", ");

  const faq = [
    {
      q: `Quante offerte di ${what} ci sono ${where}?`,
      a: `In questo momento ci sono ${jobs.length.toLocaleString("it-IT")} ${jobs.length === 1 ? "offerta attiva" : "offerte attive"}${recent ? `, di cui ${recent} ${recent === 1 ? "pubblicata" : "pubblicate"} negli ultimi 7 giorni` : ""}. L'elenco viene aggiornato più volte al giorno a partire dai siti degli enti e delle aziende.`,
    },
    topEmployers && {
      q: `Chi sta assumendo ${category.profession ? `per ${what}` : "nella sanità"} ${where}?`,
      a: `Gli enti con più offerte aperte sono ${topEmployers}.`,
    },
    salary && {
      q: `Qual è la retribuzione di riferimento per ${what}?`,
      a: `${
        salary.kind === "floor"
          ? `La retribuzione base minima prevista dal contratto è di ${formatEuro(salary.average)} lordi al mese`
          : `L'intervallo di riferimento è ${formatEuroRange(salary.low, salary.high)} lordi al mese, con un valore medio di ${formatEuro(salary.average)}`
      } (${salary.label}; importi lordi, totale annuo diviso per 12 mensilità, esclusi indennità e anzianità). Si basa su tabelle retributive pubbliche e non corrisponde alla retribuzione della singola offerta. ${withSalary ? `${withSalary} ${withSalary === 1 ? "offerta indica" : "offerte indicano"} la retribuzione nell'annuncio.` : "La maggior parte degli annunci non indica la retribuzione."}`,
    },
    {
      q: "Come mi candido?",
      a: "Apri l'offerta e premi «Candidati»: la candidatura si invia direttamente sul sito dell'ente o dell'azienda, senza costi. Puoi anche creare un avviso per ricevere le nuove offerte via email.",
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
              <h2 className="text-xl font-extrabold">Chi sta assumendo</h2>
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
          <h2 className="text-xl font-extrabold">Domande frequenti</h2>
          <div className="mt-4 space-y-5">
            {faq.map((item) => (
              <div key={item.q}>
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
              </div>
            ))}
          </div>
          {concorsiCount > 0 && category.profession && (
            <Link
              href={concorsiPath(category.profession)}
              className="mt-5 block text-sm font-bold text-primary hover:underline"
            >
              {concorsiCount === 1
                ? "Vedi il concorso o l'avviso aperto"
                : `Vedi i ${concorsiCount} concorsi e avvisi aperti`}{" "}
              per {professionLabel(category.profession)} →
            </Link>
          )}
          {news.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-extrabold">Notizie correlate</h2>
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
              href={`/stipendi/${salaryCareer.slug}`}
              className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
            >
              Vedi le tabelle retributive: {salaryCareer.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
