import { NextResponse } from "next/server";
import { reclassifyDentaria } from "@/lib/job-store";

export const dynamic = "force-dynamic";

/**
 * Reclassificação única para "Medicina Dentária" (ver job-store.ts).
 * Dry-run por omissão: só grava com `?apply=1`. Idempotente.
 */
export async function POST(request: Request) {
  const expected = process.env.SCRAPER_API_TOKEN;
  const auth = request.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const apply = new URL(request.url).searchParams.get("apply") === "1";
  const result = await reclassifyDentaria({ apply });
  return NextResponse.json({ ok: true, ...result });
}
