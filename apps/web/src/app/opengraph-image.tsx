import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "VagaSaúde — Emprego na saúde em Portugal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "linear-gradient(145deg, #07111a 0%, #0f2930 48%, #134e4a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: "#2dd4bf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#07111a",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            V
          </div>
          {SITE_NAME}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 850,
              lineHeight: 1.08,
              letterSpacing: "-0.05em",
              maxWidth: 980,
            }}
          >
            Emprego na saúde em Portugal
          </div>
          <div style={{ fontSize: 28, color: "#99f6e4", maxWidth: 820 }}>
            Todas as vagas num só sítio — público, privado e IPSS.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#cbd5e1" }}>vagasaude.pt</div>
      </div>
    ),
    { ...size },
  );
}
