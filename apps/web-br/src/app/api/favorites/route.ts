import { NextResponse } from "next/server";
import { toJobCard } from "@/lib/job-store";
import { listStoredJobs } from "@/lib/job-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("slugs") || "";
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (slugs.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  const all = await listStoredJobs("published");
  const slugSet = new Set(slugs);
  const matches = all
    .filter((job) => slugSet.has(job.slug))
    .map(toJobCard);

  return NextResponse.json({ jobs: matches });
}
