import Link from "next/link";
import {
  ICON_CROSS,
  ICON_SCALE,
  ICON_V,
  ICON_VIEWBOX,
  LOGO_VIEWBOX,
  WORD_NAVY,
  WORD_TEAL,
} from "./brand";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label="VacantesSalud — página de inicio"
      className="inline-flex items-center"
    >
      <svg
        aria-hidden="true"
        viewBox={compact ? ICON_VIEWBOX : LOGO_VIEWBOX}
        className="h-8 w-auto shrink-0 sm:h-9"
      >
        <g transform={`scale(${ICON_SCALE})`}>
          <polyline
            points={ICON_V}
            fill="none"
            strokeWidth={15}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-[#072f5f] dark:stroke-[#ffffff]"
          />
          <path
            d={ICON_CROSS}
            strokeWidth={3}
            strokeLinejoin="round"
            className="fill-[#16a6aa] stroke-[#16a6aa] dark:fill-[#3fc9c9] dark:stroke-[#3fc9c9]"
          />
        </g>
        {!compact && (
          <>
            <path d={WORD_NAVY} className="fill-[#072f5f] dark:fill-[#ffffff]" />
            <path d={WORD_TEAL} className="fill-[#16a6aa] dark:fill-[#3fc9c9]" />
          </>
        )}
      </svg>
    </Link>
  );
}
