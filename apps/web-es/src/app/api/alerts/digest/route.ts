import { NextResponse } from "next/server";
import { sendNewJobsDigest } from "@/lib/alert-digest";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.SCRAPER_API_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Resend no configurado." },
      { status: 503 },
    );
  }

  const result = await sendNewJobsDigest();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
