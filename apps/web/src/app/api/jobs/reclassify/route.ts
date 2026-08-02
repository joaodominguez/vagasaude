import { NextResponse } from "next/server";
import { reclassifyOutrosProfessions } from "@/lib/job-store";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = process.env.SCRAPER_API_TOKEN;
  const auth = request.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) return unauthorized();

  const result = await reclassifyOutrosProfessions();
  return NextResponse.json({ ok: true, ...result });
}
