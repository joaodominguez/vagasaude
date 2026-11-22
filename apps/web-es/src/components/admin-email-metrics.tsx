import {
  summarizeCampaigns,
  type CampaignRow,
  type EmailEventLine,
  type RecipientActivity,
} from "@/lib/email-events";
import type { DayStats } from "@/lib/site-stats";

export type MetricsLang = "pt" | "pt-BR" | "es" | "it";

const T = {
  pt: {
    locale: "pt-PT",
    campaigns: "Emails por campanha",
    none: "Ainda sem eventos de email (o webhook da Resend preenche isto).",
    last7: "Últimos 7 dias",
    last30: "Últimos 30 dias",
    cols: ["Campanha", "Enviados", "Entregues", "Aberturas", "Cliques", "Bounces", "Queixas"],
    note: "Aberturas e cliques em % dos entregues; contam emails distintos. As aberturas são estimativas (proteção de privacidade de alguns clientes de email).",
    events: "Eventos internos (últimos 7 dias)",
    eventsNone: "Sem eventos registados.",
    eventCol: "Evento",
    total: "Total",
    lastEmail: "Último email",
    opened: "abriu",
    notOpened: "não abriu",
    clicked: "clicou",
    notClicked: "não clicou",
    in: "em",
  },
  "pt-BR": {
    locale: "pt-BR",
    campaigns: "E-mails por campanha",
    none: "Ainda sem eventos de e-mail (o webhook da Resend preenche isto).",
    last7: "Últimos 7 dias",
    last30: "Últimos 30 dias",
    cols: ["Campanha", "Enviados", "Entregues", "Aberturas", "Cliques", "Bounces", "Reclamações"],
    note: "Aberturas e cliques em % dos entregues; contam e-mails distintos. As aberturas são estimativas (proteção de privacidade de alguns clientes de e-mail).",
    events: "Eventos internos (últimos 7 dias)",
    eventsNone: "Sem eventos registrados.",
    eventCol: "Evento",
    total: "Total",
    lastEmail: "Último e-mail",
    opened: "abriu",
    notOpened: "não abriu",
    clicked: "clicou",
    notClicked: "não clicou",
    in: "em",
  },
  es: {
    locale: "es-ES",
    campaigns: "Emails por campaña",
    none: "Aún sin eventos de email (el webhook de Resend los rellena).",
    last7: "Últimos 7 días",
    last30: "Últimos 30 días",
    cols: ["Campaña", "Enviados", "Entregados", "Aperturas", "Clics", "Rebotes", "Quejas"],
    note: "Aperturas y clics en % de los entregados; cuentan emails distintos. Las aperturas son estimaciones (protección de privacidad de algunos clientes de correo).",
    events: "Eventos internos (últimos 7 días)",
    eventsNone: "Sin eventos registrados.",
    eventCol: "Evento",
    total: "Total",
    lastEmail: "Último email",
    opened: "abrió",
    notOpened: "no abrió",
    clicked: "hizo clic",
    notClicked: "sin clic",
    in: "en",
  },
  it: {
    locale: "it-IT",
    campaigns: "Email per campagna",
    none: "Ancora nessun evento email (lo riempie il webhook di Resend).",
    last7: "Ultimi 7 giorni",
    last30: "Ultimi 30 giorni",
    cols: ["Campagna", "Inviate", "Consegnate", "Aperture", "Clic", "Bounce", "Segnalazioni"],
    note: "Aperture e clic in % delle consegnate; contano email distinte. Le aperture sono stime (protezione della privacy di alcuni client di posta).",
    events: "Eventi interni (ultimi 7 giorni)",
    eventsNone: "Nessun evento registrato.",
    eventCol: "Evento",
    total: "Totale",
    lastEmail: "Ultima email",
    opened: "aperta",
    notOpened: "non aperta",
    clicked: "clic",
    notClicked: "nessun clic",
    in: "su",
  },
} as const;

function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

function CampaignTable({ rows, lang }: { rows: CampaignRow[]; lang: MetricsLang }) {
  const t = T[lang];
  if (rows.length === 0) return <p className="px-5 py-4 text-sm text-muted">{t.none}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-muted">
            {t.cols.map((c, i) => (
              <th key={c} className={`px-5 py-2 font-semibold ${i ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.campaign}>
              <td className="px-5 py-2 font-semibold">{r.campaign}</td>
              <td className="px-5 py-2 text-right">{r.sent}</td>
              <td className="px-5 py-2 text-right">{r.delivered}</td>
              <td className="px-5 py-2 text-right">
                {r.opened} ({pct(r.opened, r.delivered)})
              </td>
              <td className="px-5 py-2 text-right">
                {r.clicked} ({pct(r.clicked, r.delivered)})
              </td>
              <td className="px-5 py-2 text-right">{r.bounced}</td>
              <td className="px-5 py-2 text-right">{r.complained}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignPanel({
  events,
  lang,
}: {
  events: EmailEventLine[];
  lang: MetricsLang;
}) {
  const t = T[lang];
  return (
    <section className="content-card mt-6 overflow-hidden">
      <h2 className="px-5 pt-4 text-lg font-extrabold tracking-[-0.03em]">{t.campaigns}</h2>
      <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.last7}</p>
      <CampaignTable rows={summarizeCampaigns(events, 7)} lang={lang} />
      <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.last30}</p>
      <CampaignTable rows={summarizeCampaigns(events, 30)} lang={lang} />
      <p className="px-5 pb-4 pt-2 text-xs text-muted">{t.note}</p>
    </section>
  );
}

export function EventsPanel({
  days,
  lang,
}: {
  days: Array<{ date: string; stats: Pick<DayStats, "events"> }>;
  lang: MetricsLang;
}) {
  const t = T[lang];
  const names = [
    ...new Set(days.flatMap((d) => Object.keys(d.stats.events ?? {}))),
  ].sort((a, b) => a.localeCompare(b));
  return (
    <section className="content-card mt-6 overflow-hidden">
      <h2 className="px-5 pt-4 text-lg font-extrabold tracking-[-0.03em]">{t.events}</h2>
      {names.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{t.eventsNone}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-5 py-2 font-semibold">{t.eventCol}</th>
                {days.map((d) => (
                  <th key={d.date} className="px-3 py-2 text-right font-semibold">
                    {d.date.slice(5)}
                  </th>
                ))}
                <th className="px-5 py-2 text-right font-semibold">{t.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {names.map((name) => {
                const counts = days.map((d) => d.stats.events?.[name] ?? 0);
                return (
                  <tr key={name}>
                    <td className="px-5 py-2 font-semibold">{name}</td>
                    {counts.map((c, i) => (
                      <td key={i} className="px-3 py-2 text-right">
                        {c || "–"}
                      </td>
                    ))}
                    <td className="px-5 py-2 text-right font-semibold">
                      {counts.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RecipientLine({
  activity,
  lang,
}: {
  activity: RecipientActivity | undefined;
  lang: MetricsLang;
}) {
  if (!activity) return null;
  const t = T[lang];
  const fmt = (iso: string) => new Date(iso).toLocaleString(t.locale);
  return (
    <p className="mt-1 text-xs text-muted">
      {t.lastEmail}: {activity.campaign || "–"} · {fmt(activity.lastSentAt)} ·{" "}
      {activity.openedAt ? `${t.opened} (${fmt(activity.openedAt)})` : t.notOpened} ·{" "}
      {activity.clickedAt
        ? `${t.clicked} (${fmt(activity.clickedAt)}${activity.clickedLink ? `, ${activity.clickedLink}` : ""})`
        : t.notClicked}
    </p>
  );
}
