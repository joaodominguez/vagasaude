import { SITE_URL } from "@/lib/seo";
import type { StoredAlert } from "@/lib/alerts";
import {
  categoryPath,
  isCategoryEligible,
  isKnownDistrict,
  isKnownProfession,
} from "@/lib/categories";
import type { JobCardData } from "@/lib/job-store";
import { enLugar } from "@/lib/es-locative";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status?: number };

/** Email listo para enviar (asunto, HTML, texto plano y cabeceras). */
export type EmailContent = Omit<SendEmailInput, "to">;

function getResendKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function isEmailConfigured() {
  return Boolean(getResendKey());
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() || "VacantesSalud <alertas@vacantessalud.es>"
  );
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = getResendKey();
  if (!apiKey) {
    return { ok: false, error: "Falta RESEND_API_KEY." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
    }),
  });

  const raw = await response.text();
  let data: { id?: string; message?: string } = {};
  try {
    data = JSON.parse(raw) as { id?: string; message?: string };
  } catch {
    // keep raw text as error
  }

  if (!response.ok || !data.id) {
    return {
      ok: false,
      status: response.status,
      error: data.message || raw || `Resend HTTP ${response.status}`,
    };
  }

  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Enlaces

type Campaign = "alerta_confirmacao" | "alerta_ativo" | "alerta_diario";

/** URL absoluta con UTM (para medir en GA4 el tráfico que llega de las alertas). */
function trackedUrl(pathOrUrl: string, campaign: Campaign) {
  const url = new URL(pathOrUrl, SITE_URL);
  url.searchParams.set("utm_source", "vacantessalud");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

function manageUrl(token: string) {
  return `${SITE_URL}/alertas/gestionar?token=${encodeURIComponent(token)}`;
}

function confirmUrl(token: string) {
  return `${SITE_URL}/alertas/confirmar?token=${encodeURIComponent(token)}`;
}

function unsubscribeUrl(token: string) {
  return `${SITE_URL}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Baja en un clic (RFC 8058), exigida por Gmail/Yahoo a quien envía en volumen. */
function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Página con las ofertas de la alerta: la landing de categoría cuando existe
 * (profesión / comunidad / combo), si no el listado filtrado.
 */
export function alertJobsPath(alert: StoredAlert, jobs: JobCardData[]) {
  const { profession, district, sector } = alert.filters;
  const p = profession && isKnownProfession(profession) ? profession : null;
  const d = district && isKnownDistrict(district) ? district : null;
  if (!sector && (p || d) && isCategoryEligible(jobs, p, d)) {
    return categoryPath(p, d);
  }
  const params = new URLSearchParams();
  if (district) params.set("comunidad", district);
  if (profession) params.set("profesion", profession);
  if (sector) params.set("sector", sector);
  const query = params.toString();
  return query ? `/empleo?${query}` : "/empleo";
}

// ---------------------------------------------------------------------------
// Texto

/** "ofertas de enfermería en Madrid", "ofertas de empleo sanitario en España (sector público)". */
export function alertSummary(alert: StoredAlert) {
  const { profession, district, sector } = alert.filters;
  const what = profession
    ? `ofertas de ${profession.toLowerCase()}`
    : "ofertas de empleo sanitario";
  const where = district ? enLugar(district) : "en España";
  const which = sector ? ` (sector ${sector.toLowerCase()})` : "";
  return `${what} ${where}${which}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("es-ES")} ${count === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// Layout (tablas + estilos inline: lo que funciona en Gmail, Outlook y Apple Mail)

const C = {
  page: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  subtle: "#94a3b8",
  border: "#e2e8f0",
  primary: "#0f766e",
  primarySoft: "#e8f7f5",
};
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;">
  <tr><td bgcolor="${C.primary}" style="border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

function paragraph(html: string, extra = "") {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.muted};${extra}">${html}</p>`;
}

function layout(input: {
  preheader: string;
  title: string;
  body: string;
  footer: string;
  campaign: Campaign;
}) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
      <tr><td style="padding:0 8px 18px;">
        <a href="${trackedUrl("/", input.campaign)}" style="text-decoration:none;font-family:${FONT};">
          <img src="${SITE_URL}/email/logo-mark.png" width="28" height="24" alt="" style="vertical-align:middle;border:0;">
          <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${C.text};">Vacantes<span style="color:${C.primary};">Salud</span></span>
        </a>
      </td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:28px 24px;font-family:${FONT};">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:800;color:${C.text};">${escapeHtml(input.title)}</h1>
        ${input.body}
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.subtle};">
        ${input.footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function alertFooter(alert: StoredAlert) {
  return `Recibes este email porque creaste una alerta de ${escapeHtml(alertSummary(alert))} en VacantesSalud.<br>
<a href="${manageUrl(alert.token)}" style="color:${C.muted};text-decoration:underline;">Gestionar o cancelar la alerta</a>
&nbsp;·&nbsp;
<a href="${SITE_URL}" style="color:${C.muted};text-decoration:underline;">vacantessalud.es</a>`;
}

function textFooter(alert: StoredAlert) {
  return [
    "—",
    `Recibes este email porque creaste una alerta de ${alertSummary(alert)} en VacantesSalud.`,
    `Gestionar o cancelar: ${manageUrl(alert.token)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tarjeta de oferta

function jobMeta(job: JobCardData) {
  return [job.contract, job.sector].filter(
    (value) => value && !/^sin especificar$/i.test(value),
  );
}

/** "Getafe, Madrid"; sin repetir la comunidad ni el país ("Madrid, España"). */
function jobPlace(job: JobCardData) {
  const city = (job.city || "").replace(/,\s*Espa[nñ]a$/i, "").trim();
  if (!city || city === job.district) return job.district || city;
  return city.includes(job.district) ? city : `${city}, ${job.district}`;
}

function chip(value: string, highlight = false) {
  return highlight
    ? `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 9px;background:${C.primarySoft};border-radius:999px;font-size:12px;font-weight:700;color:${C.primary};">${escapeHtml(value)}</span>`
    : `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border:1px solid ${C.border};border-radius:999px;font-size:12px;color:${C.muted};">${escapeHtml(value)}</span>`;
}

function jobCard(job: JobCardData, campaign: Campaign) {
  const href = trackedUrl(`/empleo/${job.slug}`, campaign);
  const chips = [
    ...(job.salary ? [chip(job.salary, true)] : []),
    ...jobMeta(job).map((value) => chip(value)),
  ].join("");
  return `<tr><td style="padding:0 0 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${C.border};border-radius:12px;">
    <tr><td style="padding:16px 16px 10px;font-family:${FONT};">
      <a href="${href}" style="font-size:16px;line-height:1.35;font-weight:700;color:${C.text};text-decoration:none;">${escapeHtml(job.title)}</a>
      <div style="margin:4px 0 10px;font-size:14px;line-height:1.5;color:${C.muted};">
        <strong style="color:${C.text};font-weight:600;">${escapeHtml(job.company)}</strong> · ${escapeHtml(jobPlace(job))}${job.publishedLabel ? ` · ${escapeHtml(job.publishedLabel)}` : ""}
      </div>
      ${chips ? `<div>${chips}</div>` : ""}
      <a href="${href}" style="display:inline-block;margin:4px 0 6px;font-size:14px;font-weight:700;color:${C.primary};text-decoration:none;">Ver oferta e inscribirme →</a>
    </td></tr>
  </table>
</td></tr>`;
}

function jobList(jobs: JobCardData[], campaign: Campaign) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
${jobs.map((job) => jobCard(job, campaign)).join("\n")}
</table>`;
}

function jobText(job: JobCardData, campaign: Campaign) {
  const meta = [job.company, jobPlace(job), job.salary, ...jobMeta(job)]
    .filter(Boolean)
    .join(" · ");
  return `• ${job.title}\n  ${meta}\n  ${trackedUrl(`/empleo/${job.slug}`, campaign)}`;
}

// ---------------------------------------------------------------------------
// Emails

/** Petición de confirmación (double opt-in). `matchingCount` = ofertas activas hoy para el filtro. */
export function alertConfirmEmail(
  alert: StoredAlert,
  matchingCount: number,
): EmailContent {
  const summary = alertSummary(alert);
  const rows: Array<[string, string]> = [
    ["Tu alerta", capitalize(summary)],
    ["Frecuencia", "Como máximo 2 emails al día (mañana y tarde) — solo cuando hay ofertas nuevas"],
  ];
  if (matchingCount > 0) {
    rows.push([
      "Ahora mismo",
      `${countLabel(matchingCount, "oferta activa", "ofertas activas")} para esta alerta`,
    ]);
  }
  const details = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 0;background:${C.primarySoft};border-radius:12px;">
${rows
  .map(
    ([label, value]) => `  <tr><td style="padding:12px 16px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.primary};">${escapeHtml(label)}</td></tr>
  <tr><td style="padding:2px 16px 12px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text};">${escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>`;

  return {
    subject: `Confirma tu alerta: ${summary}`,
    html: layout({
      campaign: "alerta_confirmacao",
      preheader:
        "Un clic para empezar a recibir las ofertas nuevas por email.",
      title: "Solo falta confirmar",
      body: `${paragraph("Confirma tu email para activar la alerta. Sin confirmación no enviamos nada.")}
${details}
${button(confirmUrl(alert.token), "Confirmar alerta")}
${paragraph("Si no has sido tú quien ha pedido esta alerta, ignora este email.", "margin:20px 0 0;font-size:13px;")}`,
      footer: `Has recibido este email porque alguien pidió una alerta de ofertas con esta dirección en <a href="${SITE_URL}" style="color:${C.muted};">vacantessalud.es</a>.`,
    }),
    text: [
      "Solo falta confirmar tu alerta de VacantesSalud",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Confirmar: ${confirmUrl(alert.token)}`,
      "",
      "Si no has sido tú quien ha pedido esta alerta, ignora este email.",
    ].join("\n"),
  };
}

/** Alerta confirmada: ya lleva las ofertas más recientes del filtro (valor inmediato). */
export function alertConfirmedEmail(
  alert: StoredAlert,
  matching: JobCardData[],
  allJobs: JobCardData[],
): EmailContent {
  const summary = alertSummary(alert);
  const latest = matching.slice(0, 5);
  const listHref = trackedUrl(alertJobsPath(alert, allJobs), "alerta_ativo");
  const intro =
    latest.length > 0
      ? `Recibirás las nuevas ${summary} por email, por la mañana y al final del día — solo cuando haya ofertas nuevas. Para empezar ya, estas son las más recientes:`
      : `Recibirás las nuevas ${summary} por email, por la mañana y al final del día, cada vez que haya ofertas nuevas.`;

  return {
    subject: `Alerta activa: ${summary}`,
    html: layout({
      campaign: "alerta_ativo",
      preheader:
        matching.length > 0
          ? `Ya hay ${countLabel(matching.length, "oferta", "ofertas")} para ti: mira las más recientes.`
          : "Te avisaremos cuando aparezcan ofertas nuevas.",
      title: "Tu alerta está activa",
      body: `${paragraph(escapeHtml(intro))}
${latest.length > 0 ? jobList(latest, "alerta_ativo") : ""}
${button(listHref, matching.length > 0 ? `Ver ${countLabel(matching.length, "oferta", "ofertas")}` : "Ver ofertas de empleo sanitario")}`,
      footer: alertFooter(alert),
    }),
    text: [
      "Tu alerta de VacantesSalud está activa",
      "",
      intro,
      ...(latest.length > 0
        ? ["", ...latest.map((job) => jobText(job, "alerta_ativo"))]
        : []),
      "",
      `Ver todas: ${listHref}`,
      "",
      textFooter(alert),
    ].join("\n"),
    headers: unsubscribeHeaders(alert.token),
  };
}

/** Resumen diario. `jobs` = ofertas a mostrar; `totalNew` = todas las nuevas (puede ser mayor). */
export function newJobsDigestEmail(
  alert: StoredAlert,
  jobs: JobCardData[],
  totalNew: number,
  allJobs: JobCardData[],
): EmailContent {
  const summary = alertSummary(alert);
  const listHref = trackedUrl(alertJobsPath(alert, allJobs), "alerta_diario");
  const companies = [...new Set(jobs.map((job) => job.company))];
  const preheader =
    companies.length > 2
      ? `${companies.slice(0, 2).join(", ")} y otras entidades están contratando.`
      : `${companies.join(" y ")} ${companies.length === 1 ? "está contratando" : "están contratando"}.`;
  const subject =
    totalNew === 1
      ? `Nueva oferta: ${jobs[0].title} — ${jobs[0].company}`
      : `${totalNew} nuevas ${summary}`;
  const more = totalNew - jobs.length;
  const moreLabel = countLabel(more, "oferta nueva", "ofertas nuevas");

  return {
    subject,
    html: layout({
      campaign: "alerta_diario",
      preheader,
      title:
        totalNew === 1 ? "1 oferta nueva para ti" : `${totalNew} ofertas nuevas para ti`,
      body: `${paragraph(`${escapeHtml(capitalize(summary))}, publicadas desde el último email.`)}
${jobList(jobs, "alerta_diario")}
${more > 0 ? paragraph(`<a href="${listHref}" style="color:${C.primary};font-weight:700;text-decoration:none;">+ ${moreLabel} más →</a>`, "margin:4px 0 0;") : ""}
${button(listHref, "Ver todas las ofertas de esta alerta")}`,
      footer: alertFooter(alert),
    }),
    text: [
      `${totalNew === 1 ? "1 oferta nueva" : `${totalNew} ofertas nuevas`} — ${summary}`,
      "",
      ...jobs.map((job) => jobText(job, "alerta_diario")),
      ...(more > 0 ? ["", `+ ${moreLabel} más`] : []),
      "",
      `Ver todas: ${listHref}`,
      "",
      textFooter(alert),
    ].join("\n"),
    headers: unsubscribeHeaders(alert.token),
  };
}
