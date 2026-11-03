import { NextResponse } from "next/server";
import {
  upsertAlertSubscription,
  type AlertFilters,
} from "@/lib/alerts";
import { buildAlertConfirmEmail } from "@/lib/alert-digest";
import { isEmailConfigured, sendEmail } from "@/lib/email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECTORS = new Set(["Público", "Privado", "Concertado"]);

function readFilter(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    district?: unknown;
    profession?: unknown;
    sector?: unknown;
  } | null;

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  const filters: Partial<AlertFilters> = {
    district: readFilter(body?.district),
    profession: readFilter(body?.profession),
    sector: readFilter(body?.sector),
  };

  if (filters.sector && !SECTORS.has(filters.sector)) {
    return NextResponse.json({ error: "Sector no válido." }, { status: 400 });
  }

  const { alert, created, needsConfirmation } = await upsertAlertSubscription({
    email,
    filters,
  });

  let emailSent = false;
  let emailError: string | null = null;

  if (isEmailConfigured() && needsConfirmation) {
    const result = await sendEmail({
      to: email,
      ...(await buildAlertConfirmEmail(alert)),
    });
    emailSent = result.ok;
    emailError = result.ok ? null : result.error;
  }

  const message = needsConfirmation
    ? emailSent
      ? "Te hemos enviado un email de confirmación. Confirma la suscripción para activar la alerta."
      : "Tu email ha quedado registrado. Si no recibes la confirmación, revísalo más tarde."
    : "Preferências actualizadas. O teu alerta continua activo.";

  return NextResponse.json(
    {
      ok: true,
      created,
      needsConfirmation,
      emailSent,
      emailConfigured: isEmailConfigured(),
      status: alert.status,
      message,
      ...(emailError ? { emailError } : {}),
    },
    { status: 201 },
  );
}
