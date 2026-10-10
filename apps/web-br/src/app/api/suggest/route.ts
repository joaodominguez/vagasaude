import { NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs-data";
import { buildSuggestions } from "@/lib/suggest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const jobs = await getJobs();
  const suggestions = buildSuggestions(jobs, q, 8);
  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
