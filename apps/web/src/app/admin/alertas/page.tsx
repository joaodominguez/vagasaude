import { describeAlertFilters, listAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  pending_confirm: "Por confirmar",
  unsubscribed: "Cancelado",
};

export default async function AdminAlertsPage() {
  const alerts = await listAlerts();
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const active = alerts.filter((alert) => alert.status === "active").length;
  const pending = alerts.filter(
    (alert) => alert.status === "pending_confirm",
  ).length;

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">Subscritores</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
            Alertas
          </h1>
          <p className="mt-1 text-sm text-muted">
            {alerts.length} email{alerts.length === 1 ? "" : "s"} · {active}{" "}
            activo{active === 1 ? "" : "s"} · {pending} por confirmar
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
            ? "Resend activo — confirmações e digests de novas vagas podem ser enviados."
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
                key={alert.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{alert.email}</p>
                  <p className="mt-1 text-xs text-muted">
                    {describeAlertFilters(alert)}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p
                    className={
                      alert.status === "active"
                        ? "font-semibold text-success"
                        : alert.status === "pending_confirm"
                          ? "font-semibold text-primary"
                          : ""
                    }
                  >
                    {STATUS_LABEL[alert.status] || alert.status}
                  </p>
                  <p className="mt-1">
                    {new Date(alert.createdAt).toLocaleString("pt-PT")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
