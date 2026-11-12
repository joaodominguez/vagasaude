import { NextResponse } from "next/server";
import { unsubscribeAlert } from "@/lib/alerts";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function readToken(request: Request) {
  return new URL(request.url).searchParams.get("token")?.trim() || "";
}

/**
 * Annullamento con un clic (RFC 8058): il client di posta fa POST all'URL
 * dell'header List-Unsubscribe con il corpo "List-Unsubscribe=One-Click".
 */
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) {
    return NextResponse.json({ error: "Token mancante." }, { status: 400 });
  }
  const alert = await unsubscribeAlert(token);
  if (!alert) {
    return NextResponse.json({ error: "Avviso non trovato." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: alert.status });
}

/** Un GET (es. antivirus che aprono in anteprima i link) non annulla: mostra la pagina di gestione. */
export async function GET(request: Request) {
  const token = readToken(request);
  const target = token
    ? `/avvisi/gestisci?token=${encodeURIComponent(token)}`
    : "/avvisi";
  return NextResponse.redirect(new URL(target, SITE_URL), 303);
}
