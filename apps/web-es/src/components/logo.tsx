import Link from "next/link";
import {
  ICON_CROSS,
  ICON_PULSE,
  ICON_TRANSFORM,
  ICON_WIDTH,
  LOGO_HEIGHT,
  LOGO_WIDTH,
  WORD_NAVY,
  WORD_TEAL,
} from "./brand";

export function Logo({ compact = false }: { compact?: boolean }) {
  const width = compact ? ICON_WIDTH : LOGO_WIDTH;
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label="VacantesSalud — página de inicio"
      className="inline-flex items-center"
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${LOGO_HEIGHT}`}
        className="h-8 w-auto shrink-0 sm:h-9"
      >
        <g
          transform={ICON_TRANSFORM}
          fill="none"
          strokeWidth={10}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={ICON_CROSS} stroke="var(--logo-navy)" />
          <path d={ICON_PULSE} stroke="var(--logo-teal)" />
        </g>
        {!compact && (
          <>
            <path d={WORD_NAVY} fill="var(--logo-navy)" />
            <path d={WORD_TEAL} fill="var(--logo-teal)" />
          </>
        )}
      </svg>
    </Link>
  );
}
