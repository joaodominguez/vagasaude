import { ImageResponse } from "next/og";
import { getJob } from "@/lib/jobs-data";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "Vaga de saúde no VagaSaúde";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ slug: string }>;

export default async function JobOpenGraphImage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const job = await getJob(slug);

  const title = job?.title ?? "Vaga de saúde";
  const company = job?.company ?? SITE_NAME;
  const location = job ? `${job.city} · ${job.profession}` : "Portugal";
  const shortTitle =
    title.length > 90 ? `${title.slice(0, 87).trimEnd()}…` : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "58px 64px",
          background:
            "linear-gradient(145deg, #07111a 0%, #0f2930 45%, #115e59 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#2dd4bf",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#07111a",
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              V
            </div>
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#99f6e4",
              background: "rgba(45,212,191,0.12)",
              border: "1px solid rgba(45,212,191,0.35)",
              borderRadius: 999,
              padding: "10px 18px",
            }}
          >
            Vaga disponível
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: shortTitle.length > 60 ? 48 : 56,
              fontWeight: 850,
              lineHeight: 1.12,
              letterSpacing: "-0.045em",
              maxWidth: 1040,
            }}
          >
            {shortTitle}
          </div>
          <div style={{ fontSize: 30, color: "#e2e8f0" }}>{company}</div>
          <div style={{ fontSize: 24, color: "#94a3b8" }}>{location}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            fontSize: 22,
            color: "#cbd5e1",
          }}
        >
          <span>Candidatura no site da entidade</span>
          <span>vagasaude.pt</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
