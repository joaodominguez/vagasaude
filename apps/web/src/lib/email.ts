import { SITE_URL } from "@/lib/seo";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status?: number };

function getResendKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function isEmailConfigured() {
  return Boolean(getResendKey());
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() || "VagaSaúde <alertas@vagasaude.pt>"
  );
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = getResendKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY em falta." };
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

export function alertCreatedEmailHtml() {
  return `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;">
      <p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0f766e;">VagaSaúde</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">O teu alerta está ativo</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;">
        Obrigado por te juntares. Vamos avisar-te quando surgirem novas oportunidades de emprego na saúde em Portugal.
      </p>
      <p style="margin:0 0 28px;">
        <a href="${SITE_URL}/vagas" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
          Ver vagas agora
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Recebeste este email porque criaste um alerta em
        <a href="${SITE_URL}" style="color:#0f766e;">vagasaude.pt</a>.
      </p>
    </div>
  </body>
</html>`;
}

export function newJobsDigestHtml(
  jobs: Array<{
    title: string;
    company: string;
    city: string;
    slug: string;
  }>,
) {
  const items = jobs
    .map(
      (job) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
          <a href="${SITE_URL}/vagas/${job.slug}" style="color:#0f766e;font-weight:700;text-decoration:none;font-size:15px;">
            ${escapeHtml(job.title)}
          </a>
          <div style="margin-top:4px;font-size:13px;color:#64748b;">
            ${escapeHtml(job.company)} · ${escapeHtml(job.city)}
          </div>
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;">
      <p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0f766e;">VagaSaúde</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Novas vagas de saúde</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;">
        Encontrámos ${jobs.length} nova${jobs.length === 1 ? "" : "s"} oportunidade${jobs.length === 1 ? "" : "s"} para ti.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${items}
      </table>
      <p style="margin:24px 0 0;">
        <a href="${SITE_URL}/vagas" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
          Ver todas as vagas
        </a>
      </p>
      <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Estás a receber este email porque criaste um alerta em vagasaude.pt.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
