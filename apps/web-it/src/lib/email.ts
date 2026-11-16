import { SITE_URL } from "@/lib/seo";
import type { StoredAlert } from "@/lib/alerts";
import {
  categoryPath,
  isCategoryEligible,
  isKnownDistrict,
  isKnownProfession,
} from "@/lib/categories";
import type { JobCardData } from "@/lib/job-store";
import { inRegione } from "@/lib/it-locative";

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

/** Email pronta da inviare (oggetto, HTML, testo semplice e header). */
export type EmailContent = Omit<SendEmailInput, "to">;

function getResendKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function isEmailConfigured() {
  return Boolean(getResendKey());
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() || "Offerte Sanità <avvisi@offertesanita.it>"
  );
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = getResendKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY mancante." };
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
    // usa il testo grezzo come errore
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
// Link

type Campaign = "avviso_conferma" | "avviso_attivo" | "avviso_giornaliero";

/** URL assoluto con UTM (per misurare in GA4 il traffico che arriva dagli avvisi). */
function trackedUrl(pathOrUrl: string, campaign: Campaign) {
  const url = new URL(pathOrUrl, SITE_URL);
  url.searchParams.set("utm_source", "offertesanita");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

function manageUrl(token: string) {
  return `${SITE_URL}/avvisi/gestisci?token=${encodeURIComponent(token)}`;
}

function confirmUrl(token: string) {
  return `${SITE_URL}/avvisi/conferma?token=${encodeURIComponent(token)}`;
}

function unsubscribeUrl(token: string) {
  return `${SITE_URL}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Disiscrizione con un clic (RFC 8058), richiesta da Gmail/Yahoo a chi invia grandi volumi. */
function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Pagina con le offerte dell'avviso: la landing di categoria quando esiste
 * (professione / regione / combinazione), altrimenti l'elenco filtrato.
 */
export function alertJobsPath(alert: StoredAlert, jobs: JobCardData[]) {
  const { profession, district, sector } = alert.filters;
  const p = profession && isKnownProfession(profession) ? profession : null;
  const d = district && isKnownDistrict(district) ? district : null;
  if (!sector && (p || d) && isCategoryEligible(jobs, p, d)) {
    return categoryPath(p, d);
  }
  const params = new URLSearchParams();
  if (district) params.set("regione", district);
  if (profession) params.set("professione", profession);
  if (sector) params.set("settore", sector);
  const query = params.toString();
  return query ? `/offerte?${query}` : "/offerte";
}

// ---------------------------------------------------------------------------
// Testo

/** "offerte di infermieristica in Lombardia", "offerte di lavoro sanitarie in Italia (settore pubblico)". */
export function alertSummary(alert: StoredAlert) {
  const { profession, district, sector } = alert.filters;
  // Le sigle (es. "OSS") restano in maiuscolo.
  const lowerProfession = profession
    ? /^[A-Z]{2,}$/.test(profession)
      ? profession
      : profession.toLowerCase()
    : "";
  const what = profession
    ? `offerte di ${lowerProfession}`
    : "offerte di lavoro sanitarie";
  const where = district ? inRegione(district) : "in Italia";
  const which = sector ? ` (settore ${sector.toLowerCase()})` : "";
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
  return `${count.toLocaleString("it-IT")} ${count === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// Layout (tabelle + stili inline: ciò che funziona in Gmail, Outlook e Apple Mail)

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
<html lang="it">
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
          <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${C.text};">Offerte <span style="color:${C.primary};">Sanità</span></span>
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
  return `Ricevi questa email perché hai creato un avviso per ${escapeHtml(alertSummary(alert))} su Offerte Sanità.<br>
<a href="${manageUrl(alert.token)}" style="color:${C.muted};text-decoration:underline;">Gestisci o annulla l'avviso</a>
&nbsp;·&nbsp;
<a href="${SITE_URL}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a>`;
}

function textFooter(alert: StoredAlert) {
  return [
    "—",
    `Ricevi questa email perché hai creato un avviso per ${alertSummary(alert)} su Offerte Sanità.`,
    `Gestisci o annulla: ${manageUrl(alert.token)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Scheda dell'offerta

function jobMeta(job: JobCardData) {
  return [job.contract, job.sector].filter(
    (value) => value && !/^non specificato$/i.test(value),
  );
}

/** "Monza, Lombardia"; senza ripetere la regione né il paese ("Milano, Italia"). */
function jobPlace(job: JobCardData) {
  const city = (job.city || "").replace(/,\s*Italia$/i, "").trim();
  if (!city || city === job.district) return job.district || city;
  return city.includes(job.district) ? city : `${city}, ${job.district}`;
}

function chip(value: string, highlight = false) {
  return highlight
    ? `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 9px;background:${C.primarySoft};border-radius:999px;font-size:12px;font-weight:700;color:${C.primary};">${escapeHtml(value)}</span>`
    : `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border:1px solid ${C.border};border-radius:999px;font-size:12px;color:${C.muted};">${escapeHtml(value)}</span>`;
}

function jobCard(job: JobCardData, campaign: Campaign) {
  const href = trackedUrl(`/offerte/${job.slug}`, campaign);
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
      <a href="${href}" style="display:inline-block;margin:4px 0 6px;font-size:14px;font-weight:700;color:${C.primary};text-decoration:none;">Vedi l'offerta e candidati →</a>
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
  return `• ${job.title}\n  ${meta}\n  ${trackedUrl(`/offerte/${job.slug}`, campaign)}`;
}

// ---------------------------------------------------------------------------
// Emails

/** Richiesta di conferma (double opt-in). `matchingCount` = offerte attive oggi per il filtro. */
export function alertConfirmEmail(
  alert: StoredAlert,
  matchingCount: number,
): EmailContent {
  const summary = alertSummary(alert);
  const rows: Array<[string, string]> = [
    ["Il tuo avviso", capitalize(summary)],
    ["Frequenza", "Al massimo 2 email al giorno (mattina e sera), solo quando ci sono nuove offerte"],
  ];
  if (matchingCount > 0) {
    rows.push([
      "In questo momento",
      `${countLabel(matchingCount, "offerta attiva", "offerte attive")} per questo avviso`,
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
    subject: `Conferma il tuo avviso: ${summary}`,
    html: layout({
      campaign: "avviso_conferma",
      preheader:
        "Un clic per iniziare a ricevere le nuove offerte via email.",
      title: "Manca solo la conferma",
      body: `${paragraph("Conferma il tuo indirizzo email per attivare l'avviso. Senza conferma non inviamo nulla.")}
${details}
${button(confirmUrl(alert.token), "Conferma avviso")}
${paragraph("Se non sei stato tu a richiedere questo avviso, ignora questa email.", "margin:20px 0 0;font-size:13px;")}`,
      footer: `Hai ricevuto questa email perché qualcuno ha richiesto un avviso di offerte con questo indirizzo su <a href="${SITE_URL}" style="color:${C.muted};">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a>.`,
    }),
    text: [
      "Manca solo la conferma del tuo avviso su Offerte Sanità",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Conferma: ${confirmUrl(alert.token)}`,
      "",
      "Se non sei stato tu a richiedere questo avviso, ignora questa email.",
    ].join("\n"),
  };
}

/** Avviso confermato: include già le offerte più recenti del filtro (valore immediato). */
export function alertConfirmedEmail(
  alert: StoredAlert,
  matching: JobCardData[],
  allJobs: JobCardData[],
): EmailContent {
  const summary = alertSummary(alert);
  const latest = matching.slice(0, 5);
  const listHref = trackedUrl(alertJobsPath(alert, allJobs), "avviso_attivo");
  const intro =
    latest.length > 0
      ? `Riceverai via email le nuove ${summary}, al mattino e a fine giornata, solo quando ci sono nuove offerte. Per cominciare subito, ecco le più recenti:`
      : `Riceverai via email le nuove ${summary}, al mattino e a fine giornata, ogni volta che ci sono nuove offerte.`;

  return {
    subject: `Avviso attivo: ${summary}`,
    html: layout({
      campaign: "avviso_attivo",
      preheader:
        matching.length > 0
          ? `Ci sono già ${countLabel(matching.length, "offerta", "offerte")} per te: guarda le più recenti.`
          : "Ti avviseremo quando compariranno nuove offerte.",
      title: "Il tuo avviso è attivo",
      body: `${paragraph(escapeHtml(intro))}
${latest.length > 0 ? jobList(latest, "avviso_attivo") : ""}
${button(listHref, matching.length > 0 ? `Vedi ${countLabel(matching.length, "offerta", "offerte")}` : "Vedi le offerte di lavoro sanitarie")}`,
      footer: alertFooter(alert),
    }),
    text: [
      "Il tuo avviso su Offerte Sanità è attivo",
      "",
      intro,
      ...(latest.length > 0
        ? ["", ...latest.map((job) => jobText(job, "avviso_attivo"))]
        : []),
      "",
      `Vedi tutte: ${listHref}`,
      "",
      textFooter(alert),
    ].join("\n"),
    headers: unsubscribeHeaders(alert.token),
  };
}

/** Riepilogo giornaliero. `jobs` = offerte da mostrare; `totalNew` = tutte le nuove (può essere maggiore). */
export function newJobsDigestEmail(
  alert: StoredAlert,
  jobs: JobCardData[],
  totalNew: number,
  allJobs: JobCardData[],
): EmailContent {
  const summary = alertSummary(alert);
  const listHref = trackedUrl(alertJobsPath(alert, allJobs), "avviso_giornaliero");
  const companies = [...new Set(jobs.map((job) => job.company))];
  const preheader =
    companies.length > 2
      ? `${companies.slice(0, 2).join(", ")} e altri enti stanno assumendo.`
      : `${companies.join(" e ")} ${companies.length === 1 ? "sta assumendo" : "stanno assumendo"}.`;
  const subject =
    totalNew === 1
      ? `Nuova offerta: ${jobs[0].title} — ${jobs[0].company}`
      : `${totalNew} nuove ${summary}`;
  const more = totalNew - jobs.length;
  const moreLabel = countLabel(more, "nuova offerta", "nuove offerte");

  return {
    subject,
    html: layout({
      campaign: "avviso_giornaliero",
      preheader,
      title:
        totalNew === 1 ? "1 nuova offerta per te" : `${totalNew} nuove offerte per te`,
      body: `${paragraph(`${escapeHtml(capitalize(summary))}, pubblicate dall'ultima email.`)}
${jobList(jobs, "avviso_giornaliero")}
${more > 0 ? paragraph(`<a href="${listHref}" style="color:${C.primary};font-weight:700;text-decoration:none;">+ ${moreLabel} →</a>`, "margin:4px 0 0;") : ""}
${button(listHref, "Vedi tutte le offerte di questo avviso")}`,
      footer: alertFooter(alert),
    }),
    text: [
      `${totalNew === 1 ? "1 nuova offerta" : `${totalNew} nuove offerte`} — ${summary}`,
      "",
      ...jobs.map((job) => jobText(job, "avviso_giornaliero")),
      ...(more > 0 ? ["", `+ ${moreLabel}`] : []),
      "",
      `Vedi tutte: ${listHref}`,
      "",
      textFooter(alert),
    ].join("\n"),
    headers: unsubscribeHeaders(alert.token),
  };
}
