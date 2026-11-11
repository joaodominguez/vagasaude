import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertForm } from "@/components/alert-form";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JobCard } from "@/components/job-card";
import { OposicionesList } from "@/components/oposiciones-list";
import { JOB_TYPE_LABEL } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";
import {
  OPOSICIONES_LIST_CAP,
  buildOposicionesFaq,
  buildOposicionesHeading,
  buildOposicionesItemListJsonLd,
  currentYear,
  filterOposiciones,
  listEligibleOposiciones,
  oposicionesDistricts,
  oposicionesPath,
  oposicionesProfessions,
  professionLower,
  type OposicionItem,
} from "@/lib/oposiciones";
import { enLugar } from "@/lib/es-locative";

/**
 * Hub /oposiciones y sub-landings /oposiciones/<profesión>[/<comunidad>].
 * `all` = todas las convocatorias abiertas; se filtra aquí por profesión/comunidad.
 */
export function OposicionesView({
  all,
  profession,
  district,
}: {
  all: OposicionItem[];
  profession: string | null;
  district: string | null;
}) {
  const items = filterOposiciones(all, profession, district);
  const shown = items.slice(0, OPOSICIONES_LIST_CAP);
  const heading = buildOposicionesHeading(profession, district);
  const path = oposicionesPath(profession, district);
  const faq = buildOposicionesFaq(items, profession, district);
  const eligible = new Set(listEligibleOposiciones(all).map((ref) => ref.path));
  const year = currentYear();

  const crumbs: BreadcrumbItem[] = [{ label: "Inicio", href: "/" }];
  if (profession) {
    crumbs.push({ label: "Oposiciones", href: "/oposiciones" });
    if (district) {
      crumbs.push({ label: profession, href: oposicionesPath(profession) });
      crumbs.push({ label: district });
    } else {
      crumbs.push({ label: profession });
    }
  } else {
    crumbs.push({ label: "Oposiciones" });
  }

  const typeCounts = new Map<string, number>();
  for (const { type } of items) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

  // Enlaces internos: profesiones (hub) o comunidades con landing propia (sub-landing de profesión).
  const professionLinks = !profession
    ? oposicionesProfessions(all)
        .filter(([name]) => eligible.has(oposicionesPath(name)))
        .map(([name, count]) => ({ label: name, count, href: oposicionesPath(name) }))
    : [];
  const districtLinks = profession && !district
    ? oposicionesDistricts(items)
        .filter(([name]) => eligible.has(oposicionesPath(profession, name)))
        .map(([name, count]) => ({ label: name, count, href: oposicionesPath(profession, name) }))
    : [];
  const siblingProfessions = profession
    ? oposicionesProfessions(all)
        .filter(([name]) => name !== profession && eligible.has(oposicionesPath(name)))
        .map(([name, count]) => ({ label: name, count, href: oposicionesPath(name) }))
    : [];

  const listItems = shown.map(({ job, type }: { job: Job; type: string }) => ({
    key: job.slug,
    profession: job.profession,
    district: job.district,
    type,
    typeLabel: JOB_TYPE_LABEL[type as keyof typeof JOB_TYPE_LABEL],
    node: <JobCard job={job} />,
  }));

  const what = profession ? `de ${professionLower(profession)}` : "del sector sanitario";
  const where = district ? ` ${enLugar(district)}` : " en España";
  const typeSummary = [...typeCounts.entries()]
    .map(([type, n]) => `${n} ${JOB_TYPE_LABEL[type as keyof typeof JOB_TYPE_LABEL].toLowerCase()}`)
    .join(", ");

  const jsonLd = buildOposicionesItemListJsonLd(`${heading} ${year}`, path, items);

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
              {items.length} {items.length === 1 ? "convocatoria abierta" : "convocatorias abiertas"}
              {typeSummary && <span className="text-muted"> · {typeSummary}</span>}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Convocatorias de oposiciones, OPE y bolsas de empleo {what}
              {where}, recogidas del BOE y de los boletines oficiales de las comunidades
              autónomas. Cada ficha enlaza a la fuente oficial, donde están las bases, los
              requisitos y el plazo de solicitud.
            </p>

            {[
              { title: "Por profesión", links: professionLinks },
              { title: `Oposiciones ${what} por comunidad`, links: districtLinks },
              { title: "Otras profesiones", links: siblingProfessions },
            ].map(
              (group) =>
                group.links.length > 0 && (
                  <nav key={group.title} className="mt-5" aria-label={group.title}>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                      {group.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {group.links.map((link) => (
                        <Link prefetch={false} key={link.href} href={link.href} className="filter-chip">
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
                <OposicionesList
                  items={listItems}
                  showProfessionFilter={!profession}
                />
                {items.length > shown.length && (
                  <p className="mt-4 text-sm text-muted">
                    Mostramos las {shown.length} convocatorias más recientes de{" "}
                    {items.length}. Usa los enlaces por profesión y comunidad para ver el resto.
                  </p>
                )}
              </>
            ) : (
              <div className="content-card px-6 py-14 text-center">
                <h2 className="text-xl font-extrabold">
                  Ahora mismo no hay convocatorias abiertas
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  Crea una alerta y te avisamos cuando se publique una oposición o bolsa.
                </p>
                <Link className="button button-primary mt-6 inline-flex" href="/alertas">
                  Crear alerta
                </Link>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="alert-card">
              <h2 className="flex items-center gap-2 font-extrabold">
                <Bell size={18} /> Avisos de oposiciones
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Recibe nuevas convocatorias {what}
                {district ? ` ${enLugar(district)}` : ""} por email.
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
              <h2 className="font-extrabold text-foreground">Antes de presentarte</h2>
              <p className="mt-2">
                Comprueba siempre las bases oficiales: allí figuran los requisitos, las tasas y el
                plazo de solicitud, que fija cada convocatoria.
              </p>
            </div>
          </aside>
        </div>

        <section className="border-t border-border bg-surface">
          <div className="page-container py-10">
            <h2 className="text-xl font-extrabold">Preguntas frecuentes</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
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
