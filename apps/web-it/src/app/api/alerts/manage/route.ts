import { NextResponse } from "next/server";
import {
  confirmAlert,
  unsubscribeAlert,
  updateAlertPreferences,
  type AlertFilters,
} from "@/lib/alerts";
import { buildAlertConfirmedEmail } from "@/lib/alert-digest";
import { isEmailConfigured, sendEmail } from "@/lib/email";

const SECTORS = new Set(["Pubblico", "Privato", "Accreditato"]);

function readFilter(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    action?: unknown;
    district?: unknown;
    profession?: unknown;
    sector?: unknown;
  } | null;

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Token mancante." }, { status: 400 });
  }

  if (action === "unsubscribe") {
    const alert = await unsubscribeAlert(token);
    if (!alert) {
      return NextResponse.json({ error: "Avviso non trovato." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: alert.status });
  }

  if (action === "confirm") {
    const alert = await confirmAlert(token);
    if (!alert) {
      return NextResponse.json({ error: "Avviso non trovato." }, { status: 404 });
    }
    if (isEmailConfigured() && alert.status === "active") {
      await sendEmail({
        to: alert.email,
        ...(await buildAlertConfirmedEmail(alert)),
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true, status: alert.status });
  }

  if (action === "update") {
    const filters: Partial<AlertFilters> = {
      district: readFilter(body?.district),
      profession: readFilter(body?.profession),
      sector: readFilter(body?.sector),
    };
    if (filters.sector && !SECTORS.has(filters.sector)) {
      return NextResponse.json({ error: "Settore non valido." }, { status: 400 });
    }
    const alert = await updateAlertPreferences(token, filters);
    if (!alert) {
      return NextResponse.json({ error: "Avviso non trovato." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      status: alert.status,
      filters: alert.filters,
    });
  }

  return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
}
