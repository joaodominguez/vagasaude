import { listAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const alerts = await listAlerts();
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Subscritores</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Alertas
          </h1>
          <p className="mt-1 text-sm text-muted">
            {alerts.length} email{alerts.length === 1 ? "" : "s"} registado
            {alerts.length === 1 ? "" : "s"}
          </p>
        </header>

        <div
          className={`mt-6 rounded-xl px-4 py-3 text-sm ${
            resendConfigured
              ? "bg-success-soft text-success"
              : "bg-primary-soft text-muted"
          }`}
        >
          {resendConfigured
            ? "Resend configurado — confirmações de alerta podem ser enviadas."
            : "Resend ainda não está configurado. Os emails ficam só guardados."}
        </div>

        <section className="content-card mt-6 overflow-hidden">
          <div className="divide-y divide-border">
            {alerts.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted">
                Ainda não há subscritores.
              </p>
            )}
            {alerts.map((alert) => (
              <article
                key={`${alert.email}-${alert.createdAt}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <p className="text-sm font-semibold">{alert.email}</p>
                <p className="text-xs text-muted">
                  {new Date(alert.createdAt).toLocaleString("pt-PT")}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
