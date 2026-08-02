import { getJobStats } from "@/lib/job-store";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const stats = await getJobStats();
  const rows = [
    ["Site", SITE_URL],
    ["Ambiente", process.env.NODE_ENV || "production"],
    ["DATA_DIR", process.env.DATA_DIR || "(default)"],
    ["GA4", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-2FTGH5C1GQ"],
    ["Resend", process.env.RESEND_API_KEY ? "Configurado" : "Por configurar"],
    [
      "Última ingestão",
      stats.updatedAt
        ? new Date(stats.updatedAt).toLocaleString("pt-PT")
        : "—",
    ],
    ["Total vagas", String(stats.total)],
    ["Publicadas", String(stats.published)],
    ["Em revisão", String(stats.pendingReview)],
    ["Expiradas", String(stats.expired)],
  ];

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Operação</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Sistema
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configuração e estado da infraestrutura.
          </p>
        </header>

        <section className="content-card mt-8 overflow-hidden">
          <dl className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:items-center"
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="break-all text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
