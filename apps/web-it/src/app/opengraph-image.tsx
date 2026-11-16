import { ImageResponse } from "next/og";
import { LOGO_HEIGHT, LOGO_WIDTH, logoSvg } from "@/components/brand";

export const runtime = "nodejs";
export const alt = "Offerte Sanità — Lavoro nella sanità in Italia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg("#ffffff", "#3fd0c9"))}`;
const LOGO_H = 72;

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
          width={Math.round((LOGO_WIDTH * LOGO_H) / LOGO_HEIGHT)}
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
            Lavoro nella sanità in Italia
          </div>
          <div style={{ fontSize: 28, color: "#99f6e4", maxWidth: 820 }}>
            Tutte le offerte in un unico posto: pubblico, privato e accreditato.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#cbd5e1" }}>offertesanita.it</div>
      </div>
    ),
    { ...size },
  );
}
