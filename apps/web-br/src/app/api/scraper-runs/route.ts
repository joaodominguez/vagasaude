import { NextResponse } from "next/server";
import { listScraperRuns, recordScraperRun } from "@/lib/scraper-runs";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

function authorize(request: Request) {
  const expected = process.env.SCRAPER_API_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  // Admin UI reads via server components; keep GET token-protected for ops.
  if (!authorize(request)) return unauthorized();
  const runs = await listScraperRuns(100);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  if (!authorize(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    source?: unknown;
    status?: unknown;
    found?: unknown;
    created?: unknown;
    updated?: unknown;
    ignored?: unknown;
    review?: unknown;
    elapsed?: unknown;
    error?: unknown;
    startedAt?: unknown;
    finishedAt?: unknown;
  } | null;

  const source = typeof body?.source === "string" ? body.source.trim() : "";
  const status = body?.status === "error" ? "error" : "ok";
  if (!source) {
    return NextResponse.json({ error: "source em falta." }, { status: 400 });
  }

  const run = await recordScraperRun({
    source,
    status,
    found: typeof body?.found === "number" ? body.found : 0,
    created: typeof body?.created === "number" ? body.created : null,
    updated: typeof body?.updated === "number" ? body.updated : null,
    ignored: typeof body?.ignored === "number" ? body.ignored : null,
    review: typeof body?.review === "number" ? body.review : null,
    elapsed: typeof body?.elapsed === "number" ? body.elapsed : null,
    error: typeof body?.error === "string" ? body.error : null,
    startedAt: typeof body?.startedAt === "string" ? body.startedAt : null,
    finishedAt: typeof body?.finishedAt === "string" ? body.finishedAt : null,
  });

  return NextResponse.json({ ok: true, run }, { status: 201 });
}
