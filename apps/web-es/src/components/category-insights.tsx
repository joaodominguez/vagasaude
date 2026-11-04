import Link from "next/link";
import type { Job } from "@/lib/jobs";
import {
  categoryPath,
  isKnownDistrict,
  isKnownProfession,
  type CategoryRef,
} from "@/lib/categories";
import { enLugar } from "@/lib/es-locative";
import { isOposicionJob } from "@/lib/job-type";
import { oposicionesPath } from "@/lib/oposiciones";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";
import { careerForProfession } from "@/lib/salary-tables";

const DAY_MS = 86_400_000;

const professionLabel = (profession: string) =>
  profession === "TCAE" ? "TCAE" : profession.toLowerCase();

function countBy(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit);
}

/** Ofertas publicadas en los últimos `days` días (página estática: calculado en build/ISR). */
function countRecentJobs(jobs: Job[], days: number) {
  const since = Date.now() - days * DAY_MS;
  return jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && t >= since;
  }).length;
}

/**
 * Contenido propio de la landing (página 1): dónde están las ofertas (con enlaces a
 * las landings profesión × comunidad), quién contrata, sueldo de referencia y FAQ.
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
  const recent = countRecentJobs(jobs, 7);
  const withSalary = jobs.filter((job) => job.salary).length;
  const employers = countBy(
    jobs.map((job) => job.company),
    8,
  );
  const what = category.profession
    ? category.profession.toLowerCase()
    : "sanitario";
  const where = category.province
    ? enLugar(category.province)
    : category.district
      ? enLugar(category.district)
      : "en España";

  // Dónde están: profesión → comunidades; comunidad → profesiones; combo → localidades.
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
      ? `Ofertas de ${what} por comunidad`
      : category.kind === "district"
        ? `Profesiones con ofertas ${where}`
        : category.kind === "province"
        ? `Localidades con ofertas ${where}`
        : `Localidades con ofertas de ${what} ${where}`;

  const salary =
    category.profession && category.profession !== "Otros"
      ? getSalaryBenchmark(category.profession)
      : null;
  const salaryCareer = careerForProfession(category.profession ?? null);
  const oposicionesCount =
    category.kind === "profession" && category.profession
      ? jobs.filter(isOposicionJob).length
      : 0;
  const topEmployers = employers
    .slice(0, 3)
    .map(([name]) => name)
    .join(", ");

  const faq = [
    {
      q: `¿Cuántas ofertas de ${what} hay ${where}?`,
      a: `Ahora mismo hay ${jobs.length.toLocaleString("es-ES")} ${jobs.length === 1 ? "oferta activa" : "ofertas activas"}${recent ? `, ${recent} ${recent === 1 ? "publicada" : "publicadas"} en los últimos 7 días` : ""}. La lista se actualiza varias veces al día a partir de las webs de las propias entidades.`,
    },
    topEmployers && {
      q: `¿Quién está contratando ${category.profession ? `para ${what}` : "en sanidad"} ${where}?`,
      a: `Las entidades con más ofertas abiertas son ${topEmployers}.`,
    },
    salary && {
      q: `¿Cuál es el sueldo de referencia en ${what}?`,
      a: `${
        salary.kind === "floor"
          ? `El sueldo base mínimo de convenio es de ${formatEuro(salary.average)} brutos al mes`
          : `El rango de referencia es ${formatEuroRange(salary.low, salary.high)} brutos al mes, con un punto medio de ${formatEuro(salary.average)}`
      } (${salary.label}; importes en bruto, total anual entre 12 con las pagas extra prorrateadas, sin guardias ni antigüedad). Se basa en ${salary.kind === "floor" ? "tablas de convenio publicadas en el BOE" : "tablas retributivas oficiales de servicios de salud"} y no es el sueldo de cada oferta. ${withSalary ? `${withSalary} ${withSalary === 1 ? "oferta indica" : "ofertas indican"} la retribución en el anuncio.` : "La mayoría de los anuncios no indica la retribución."}`,
    },
    {
      q: "¿Cómo me inscribo?",
      a: "Abre la oferta y pulsa «Inscribirme»: la solicitud se hace directamente en la web de la entidad, sin coste. También puedes crear una alerta para recibir nuevas ofertas por email.",
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
              <h2 className="text-xl font-extrabold">Quién está contratando</h2>
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
          <h2 className="text-xl font-extrabold">Preguntas frecuentes</h2>
          <div className="mt-4 space-y-5">
            {faq.map((item) => (
              <div key={item.q}>
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
              </div>
            ))}
          </div>
          {oposicionesCount > 0 && category.profession && (
            <Link
              href={oposicionesPath(category.profession)}
              className="mt-5 block text-sm font-bold text-primary hover:underline"
            >
              {oposicionesCount === 1
                ? "Ver la oposición o bolsa abierta"
                : `Ver las ${oposicionesCount} oposiciones y bolsas abiertas`}{" "}
              de {professionLabel(category.profession)} →
            </Link>
          )}
          {salaryCareer && (
            <Link
              href={`/salarios/${salaryCareer.slug}`}
              className="mt-5 inline-flex text-sm font-bold text-primary hover:underline"
            >
              Ver las tablas salariales de {salaryCareer.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
