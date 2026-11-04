import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { formatBRL } from "@/lib/salary-benchmarks";
import { NetSalarySimulator } from "@/components/net-salary-simulator";
import { SalaryOfficialTables } from "@/components/salary-official-tables";
import { SITE_NAME, truncateMeta } from "@/lib/seo";
import { OFFICIAL_TABLES, SOURCES } from "@/lib/salary-tables";
import {
  salaryPath,
  type getSalaryPage,
  type SalaryRole,
  type SalaryStats,
} from "@/lib/salary-observatory";

type SalaryPageData = NonNullable<Awaited<ReturnType<typeof getSalaryPage>>>;

const YEAR = 2026;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function where(district: string | null) {
  return district ? `em ${district}` : "no Brasil";
}

function money(value: number) {
  return formatBRL(Math.round(value / 10) * 10);
}

export function buildSalaryMetadata(
  role: SalaryRole,
  district: string | null,
  stats: SalaryStats,
): Metadata {
  const title = `Salário de ${role.label} ${where(district)} em ${YEAR}: ${money(stats.median)}`;
  const description = truncateMeta(
    `Quanto ganha um ${role.label} ${where(district)}: mediana de ${money(stats.median)} por mês e faixa típica de ${money(stats.p25)} a ${money(stats.p75)}, com base em ${stats.count} vagas reais com salário anunciado. Atualizado diariamente.`,
    160,
  );
  const url = salaryPath(role, district);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: SITE_NAME, locale: "pt_BR" },
  };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="content-card p-5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function StatsTable({
  title,
  rows,
  linkFor,
}: {
  title: string;
  rows: Array<{ name: string; stats: SalaryStats }>;
  linkFor?: (name: string) => string | null;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="content-card overflow-x-auto p-5">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <table className="mt-4 w-full min-w-[28rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="pb-2 font-extrabold">Nome</th>
            <th className="pb-2 text-right font-extrabold">Mediana</th>
            <th className="whitespace-nowrap pb-2 pl-3 text-right font-extrabold">Faixa típica</th>
            <th className="pb-2 pl-3 text-right font-extrabold">Vagas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = linkFor?.(row.name);
            return (
              <tr key={row.name} className="border-t border-border">
                <td className="py-2.5 pr-3">
                  {href ? (
                    <Link href={href} className="font-semibold text-primary hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </td>
                <td className="py-2.5 text-right font-semibold">{money(row.stats.median)}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right text-muted">
                  {money(row.stats.p25)} – {money(row.stats.p75)}
                </td>
                <td className="py-2.5 text-right text-muted">{row.stats.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function SalaryPageView({
  data,
  jobsHref,
}: {
  data: SalaryPageData;
  jobsHref: string;
}) {
  const { role, district, stats } = data;
  const updated = data.updatedAt
    ? new Date(data.updatedAt).toLocaleDateString("pt-BR")
    : null;
  const crumbs: BreadcrumbItem[] = [
    { label: "Início", href: "/" },
    { label: "Salários", href: "/salarios" },
    { label: capitalize(role.label), href: salaryPath(role) },
  ];
  if (district) crumbs.push({ label: district });
  const floorGap = role.floor ? (stats.median / role.floor.value - 1) * 100 : null;

  const officialTables = OFFICIAL_TABLES[role.slug] ?? [];
  const sources = [
    ...new Map(
      [
        ...officialTables.flatMap((table) => table.rows.map((row) => row.source)),
        SOURCES.inss,
        SOURCES.receita,
        SOURCES.lei15270,
      ].map((source) => [source.url, source]),
    ).values(),
  ];

  const faq = [
    {
      q: `Quanto ganha um ${role.label} ${where(district)} em ${YEAR}?`,
      a: `Nas ${stats.count} vagas com salário anunciado que analisamos, o salário mediano é ${money(stats.median)} por mês. Metade das vagas paga entre ${money(stats.p25)} e ${money(stats.p75)}; os valores vão de ${money(stats.min)} a ${money(stats.max)}.`,
    },
    ...(role.floor
      ? [
          {
            q: `Qual é o piso salarial de ${role.label}?`,
            a: `O piso nacional é ${formatBRL(role.floor.value)} por mês (${role.floor.note}) A mediana dos anúncios ${where(district)} está ${Math.abs(floorGap ?? 0).toFixed(0)}% ${(floorGap ?? 0) >= 0 ? "acima" : "abaixo"} desse valor — muitas vagas têm jornadas menores que 44 h.`,
          },
        ]
      : []),
    {
      q: "De onde vêm estes números?",
      a: "São salários anunciados pelos próprios empregadores (hospitais, clínicas, laboratórios e redes de farmácias) nas vagas agregadas pelo VagaSaúde nos últimos 6 meses. Não incluímos concursos com vários cargos no mesmo edital, residências, estágios, nem valores por hora ou plantão.",
    },
  ];

  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Salário de {role.label} {where(district)} em {YEAR}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Com base em <strong className="text-foreground">{stats.count} vagas reais</strong>{" "}
              com salário anunciado pelos empregadores, um {role.label} {where(district)} ganha em
              média <strong className="text-foreground">{money(stats.median)} por mês</strong>{" "}
              (mediana). Metade das vagas paga entre {money(stats.p25)} e {money(stats.p75)}.
              {updated && ` Dados atualizados em ${updated}.`}
            </p>
          </div>
        </section>

        <div className="page-container space-y-6 py-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Salário mediano" value={money(stats.median)} hint="por mês, bruto" />
            <StatCard
              label="Faixa típica"
              value={`${money(stats.p25)} – ${money(stats.p75)}`}
              hint="metade das vagas"
            />
            <StatCard
              label="Vagas analisadas"
              value={String(stats.count)}
              hint="com salário anunciado"
            />
          </div>

          {role.floor && (
            <section className="alert-card">
              <h2 className="font-extrabold">Piso nacional: {formatBRL(role.floor.value)}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{role.floor.note}</p>
            </section>
          )}

          {data.openJobs.length > 0 && (
            <section className="content-card p-5">
              <h2 className="text-lg font-extrabold">Vagas abertas com salário</h2>
              <ul className="mt-3 divide-y divide-border">
                {data.openJobs.map((job) => (
                  <li key={job.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <Link href={`/vagas/${job.slug}`} className="font-semibold hover:text-primary">
                        {job.title}
                      </Link>
                      <span className="block text-sm text-muted">
                        {job.company} · {job.district}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-primary">{job.salaryText}</span>
                  </li>
                ))}
              </ul>
              <Link href={jobsHref} className="button button-secondary mt-4 inline-flex">
                Ver todas as vagas de {role.label}
              </Link>
            </section>
          )}

          {!district && officialTables.length > 0 && <SalaryOfficialTables tables={officialTables} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <StatsTable
              title="Por estado"
              rows={data.byState}
              linkFor={(name) => {
                const path = salaryPath(role, name);
                return data.statePages.has(path) ? path : null;
              }}
            />
            <StatsTable title="Por empregador" rows={data.byCompany} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-extrabold">Calcule seu salário líquido</h2>
            <NetSalarySimulator initialGross={role.floor?.value ?? Math.round(stats.median)} />
            <p className="mt-2 text-sm">
              <Link href="/salarios/simulador-salario-liquido" className="font-semibold text-primary hover:underline">
                Abrir o simulador de salário líquido
              </Link>
            </p>
          </section>

          <section className="content-card p-5">
            <h2 className="text-lg font-extrabold">Perguntas frequentes</h2>
            <div className="mt-4 space-y-5">
              {faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-bold">{item.q}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs leading-5 text-muted">
            Fontes oficiais:{" "}
            {sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 && "; "}
                <a href={source.url} className="underline" rel="noopener" target="_blank">
                  {source.label}
                </a>
              </span>
            ))}
            . Salários dos anúncios: vagas reais agregadas pelo VagaSaúde; valores brutos mensais.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
