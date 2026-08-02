import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  alertCreatedEmailHtml,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";

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

  const alreadyExists = alerts.some((alert) => alert.email === email);
  if (!alreadyExists) {
    alerts.push({ email, createdAt: new Date().toISOString() });
    await writeFile(alertsFile, JSON.stringify(alerts, null, 2), {
      mode: 0o600,
    });
  }

  let emailSent = false;
  let emailError: string | null = null;

  if (isEmailConfigured()) {
    const result = await sendEmail({
      to: email,
      subject: alreadyExists
        ? "O teu alerta VagaSaúde continua ativo"
        : "O teu alerta VagaSaúde está ativo",
      html: alertCreatedEmailHtml(),
    });
    emailSent = result.ok;
    emailError = result.ok ? null : result.error;
  }

  return NextResponse.json(
    {
      ok: true,
      alreadyExists,
      emailSent,
      emailConfigured: isEmailConfigured(),
      ...(emailError ? { emailError } : {}),
    },
    { status: 201 },
  );
}
