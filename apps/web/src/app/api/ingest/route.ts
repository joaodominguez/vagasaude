import { NextResponse } from "next/server";
import { ingestJobs, type IngestJobInput } from "@/lib/job-store";

export const dynamic = "force-dynamic";

const SECTORS = new Set(["publico", "privado", "ipss"]);

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = process.env.SCRAPER_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SCRAPER_API_TOKEN não configurado." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as {
    source?: unknown;
    jobs?: unknown;
  } | null;

  const source = typeof body?.source === "string" ? body.source.trim() : "";
  if (!source || !Array.isArray(body?.jobs)) {
    return NextResponse.json(
      { error: "Pedido inválido. Esperado { source, jobs[] }." },
      { status: 400 },
    );
  }

  const jobs: IngestJobInput[] = [];
  for (const item of body.jobs) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const sector = String(row.sector || "");
    if (!SECTORS.has(sector)) continue;
    jobs.push({
      title: String(row.title || ""),
      company: String(row.company || ""),
      location_district: String(row.location_district || ""),
      location_concelho:
        row.location_concelho == null ? null : String(row.location_concelho),
      profession: String(row.profession || "Outros"),
      specialty: row.specialty == null ? null : String(row.specialty),
      sector: sector as IngestJobInput["sector"],
      contract_type:
        row.contract_type == null ? null : String(row.contract_type),
      description: String(row.description || ""),
      requirements:
        row.requirements == null ? null : String(row.requirements),
      salary: row.salary == null ? null : String(row.salary),
      application_url: String(row.application_url || ""),
      source,
      source_id: String(row.source_id || ""),
      published_at: row.published_at == null ? null : String(row.published_at),
      expires_at: row.expires_at == null ? null : String(row.expires_at),
      status: (row.status as IngestJobInput["status"]) || undefined,
      review_reason:
        row.review_reason == null ? null : String(row.review_reason),
    });
  }

  const result = await ingestJobs(source, jobs);
  return NextResponse.json(result);
}
