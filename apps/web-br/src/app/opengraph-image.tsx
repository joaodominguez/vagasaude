import { ImageResponse } from "next/og";
import { LOGO_ASPECT, logoSvg } from "@/components/brand";

export const runtime = "nodejs";
export const alt = "VagaSaúde — Emprego na saúde no Brasil";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg("#ffffff", "#3fc9c9"))}`;
const LOGO_H = 64;

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt=""
          width={Math.round(LOGO_H * LOGO_ASPECT)}
          height={LOGO_H}
        />

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
            Emprego na saúde no Brasil
          </div>
          <div style={{ fontSize: 28, color: "#99f6e4", maxWidth: 820 }}>
            Todas as vagas em um só site — público, privado e filantrópico.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#cbd5e1" }}>vagasaude.com.br</div>
      </div>
    ),
    { ...size },
  );
}
