import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getMarketPanorama, type PanoramaRow } from "@/lib/market-panorama";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

const title = "Mercado laboral sanitario: panorama de las ofertas de empleo en España";
const description =
  "Cuántas ofertas de empleo sanitario hay abiertas en España, en qué comunidades, para qué profesiones, con qué contratos y qué empleadores contratan más. Datos actualizados cada día a partir de ofertas reales.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/datos" },
  openGraph: { title, description, url: "/datos", type: "website", siteName: SITE_NAME, locale: "es_ES" },
};

const int = (value: number) => value.toLocaleString("es-ES");
const pct = (share: number) =>
  share > 0 && share < 0.001
    ? "<0,1 %"
    : share.toLocaleString("es-ES", {
    style: "percent",
    minimumFractionDigits: share > 0 && share < 0.1 ? 1 : 0,
    maximumFractionDigits: share > 0 && share < 0.1 ? 1 : 0,
  });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="content-card p-4">
      <p className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{label}</p>
    </div>
  );
}

function RowsTable({
  heading,
  caption,
  rows,
  labelHeader,
}: {
  heading: string;
  caption?: string;
  rows: PanoramaRow[];
  labelHeader: string;
}) {
  const max = rows.reduce((m, row) => Math.max(m, row.share), 0);
  return (
    <section className="content-card overflow-x-auto p-5">
      <h2 className="text-lg font-extrabold">{heading}</h2>
      {caption && <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>}
      <table className="mt-4 w-full min-w-[20rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="pb-2 font-extrabold">{labelHeader}</th>
            <th className="pb-2 text-right font-extrabold">Ofertas</th>
            <th className="pb-2 pl-3 text-right font-extrabold">% del total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border align-middle">
              <td className="py-2.5 pr-3">
                {row.href ? (
                  <Link prefetch={false} href={row.href} className="font-semibold text-primary hover:underline">
                    {row.label}
                  </Link>
                ) : (
                  <span className="font-semibold">{row.label}</span>
                )}
                <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-primary-soft" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max(max ? (row.share / max) * 100 : 0, 1.5)}%` }}
                  />
                </div>
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{int(row.count)}</td>
              <td className="py-2.5 pl-3 text-right text-muted tabular-nums">{pct(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function DataPage() {
  const data = await getMarketPanorama();
  const dateLabel = data.generatedAt.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  const isoDate = data.generatedAt.toISOString().slice(0, 10);
  const citation = `Fuente: ${SITE_NAME}, «Mercado laboral sanitario: panorama de las ofertas de empleo en España» (vacantessalud.es/datos), datos del ${dateLabel}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Panorama de las ofertas de empleo sanitario en España",
    description: `Número de ofertas de empleo sanitario abiertas en España, por comunidad autónoma, profesión, sector, tipo de contrato y empleador, calculado a diario a partir de las ofertas activas que reúne ${SITE_NAME} (portales de empleo de hospitales, grupos sanitarios, residencias, clínicas, farmacias y bolsas públicas). Incluye el porcentaje de ofertas con salario mensual publicado.`,
    url: absoluteUrl("/datos"),
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
    inLanguage: "es-ES",
    spatialCoverage: { "@type": "Place", name: "España" },
    temporalCoverage: isoDate,
    dateModified: data.generatedAt.toISOString(),
    variableMeasured: [
      "Ofertas activas por comunidad autónoma",
      "Ofertas activas por profesión",
      "Ofertas activas por empleador",
      "Ofertas activas por sector",
      "Ofertas activas por tipo de contrato",
      "Porcentaje de ofertas con salario publicado",
    ],
    keywords: ["empleo sanitario", "mercado laboral sanidad", "empleo enfermería", "ofertas por comunidad"],
  };

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Datos" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Mercado laboral sanitario: panorama de las ofertas de empleo en España
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Cuántas ofertas de empleo sanitario hay abiertas ahora, en qué comunidades, para qué
              profesiones y quién contrata más. Las cifras salen de las ofertas activas que {SITE_NAME}
              reúne de hospitales, grupos sanitarios, residencias, clínicas, farmacias y bolsas públicas,
              y se actualizan cada día. Datos del <strong>{dateLabel}</strong>.
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={int(data.total)} label="ofertas de empleo sanitario abiertas" />
            <Stat value={int(data.companies)} label="empleadores con ofertas" />
            <Stat value={int(data.lastWeek)} label="ofertas publicadas en los últimos 7 días" />
            <Stat value={pct(data.withSalaryShare)} label="de las ofertas publican el salario" />
          </div>

          <RowsTable
            heading="Ofertas por comunidad autónoma"
            caption={`Las ${int(data.total)} ofertas abiertas, en ${data.states} comunidades y ciudades autónomas; «España» reúne las ofertas nacionales o remotas, sin comunidad definida.`}
            labelHeader="Comunidad"
            rows={data.byState}
          />

          <RowsTable
            heading="Ofertas por profesión"
            caption={
              data.professions > data.byProfession.length
                ? `Las ${data.byProfession.length} áreas con más ofertas, de ${data.professions} en total.`
                : `Las ${data.professions} áreas, de la que tiene más ofertas a la que tiene menos.`
            }
            labelHeader="Profesión"
            rows={data.byProfession}
          />

          <RowsTable
            heading="Empleadores con más ofertas"
            caption={`Los 15 empleadores con más ofertas abiertas. Consulta los ${data.employerPages} con página propia en Empresas.`}
            labelHeader="Empleador"
            rows={data.topEmployers}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <RowsTable heading="Por sector" labelHeader="Sector" rows={data.bySector} />
            <RowsTable
              heading="Por tipo de contrato"
              caption="Según lo indica el empleador; muchas ofertas no indican el contrato."
              labelHeader="Contrato"
              rows={data.byContract}
            />
          </div>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Salarios</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              {int(data.withSalary)} de las {int(data.total)} ofertas ({pct(data.withSalaryShare)}) publican
              un salario mensual. Consulta cuánto pagan, puesto a puesto, y cómo se comparan con las
              tablas de los convenios en{" "}
              <Link href="/salarios" className="font-semibold text-primary hover:underline">
                Salarios en sanidad
              </Link>
              .
            </p>
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Cómo citar estos datos</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Puedes usar estas cifras libremente en reportajes, artículos y trabajos, siempre que
              cites la fuente con un enlace a esta página:
            </p>
            <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6">
              {citation}
            </p>
          </section>

          <section className="text-sm leading-7 text-muted">
            <h2 className="text-base font-extrabold">Metodología</h2>
            <p className="mt-2">
              Contamos las ofertas activas en {SITE_NAME} en el momento de la actualización, procedentes
              de {data.sources} fuentes: portales de empleo de hospitales y grupos sanitarios,
              residencias, clínicas, farmacias y bolsas públicas. Cada oferta cuenta una vez: las
              republicaciones de la misma oferta se agrupan, y las ofertas cerradas o sin actualizar
              desde hace más de 7 días dejan de contar. La comunidad, la profesión, el sector y el tipo de
              contrato siguen la información de la propia oferta; «No indicado» significa que la oferta
              no indica el contrato. El salario solo cuenta cuando la oferta publica un importe mensual.
              Las cifras cambian a lo largo del día, a medida que se actualizan las ofertas.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
