import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type StoredAlert = {
  email: string;
  createdAt: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const dataDirectory =
    process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  const alertsFile = path.join(dataDirectory, "alerts.json");

  await mkdir(dataDirectory, { recursive: true });

  let alerts: StoredAlert[] = [];
  try {
    alerts = JSON.parse(await readFile(alertsFile, "utf8")) as StoredAlert[];
  } catch {
    // O ficheiro é criado no primeiro alerta.
  }

  if (!alerts.some((alert) => alert.email === email)) {
    alerts.push({ email, createdAt: new Date().toISOString() });
    await writeFile(alertsFile, JSON.stringify(alerts, null, 2), {
      mode: 0o600,
    });
  }

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "VagaSaúde <alertas@vagasaude.pt>",
        to: [email],
        subject: "O teu alerta VagaSaúde está criado",
        html: "<p>O teu alerta foi criado. Avisaremos quando surgirem novas oportunidades de saúde.</p>",
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
