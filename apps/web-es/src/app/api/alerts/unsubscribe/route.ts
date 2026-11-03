import { NextResponse } from "next/server";
import { unsubscribeAlert } from "@/lib/alerts";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function readToken(request: Request) {
  return new URL(request.url).searchParams.get("token")?.trim() || "";
}

/**
 * Cancelamento num clique (RFC 8058): o cliente de email faz POST para o URL do
 * cabecera List-Unsubscribe com o corpo "List-Unsubscribe=One-Click".
 */
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) {
    return NextResponse.json({ error: "Falta el token." }, { status: 400 });
  }
  const alert = await unsubscribeAlert(token);
  if (!alert) {
    return NextResponse.json({ error: "Alerta no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: alert.status });
}

/** Um GET (ex.: antivirus que previsualizan enlaces) no cancela: muestra la página de gestión. */
export async function GET(request: Request) {
  const token = readToken(request);
  const target = token
    ? `/alertas/gestionar?token=${encodeURIComponent(token)}`
    : "/alertas";
  return NextResponse.redirect(new URL(target, SITE_URL), 303);
}
