/**
 * Ícones dos cartões de vaga (desenhos do lucide 1.32, iguais aos anteriores) num sprite SVG:
 * cada desenho fica 1 vez por página e os cartões só o referenciam com <use>. Antes cada cartão
 * trazia ~5 SVG completos (50 cartões → ~260 SVG no HTML e outra vez no payload RSC).
 */
export type CardIconName = "arrow-up-right" | "building-2" | "map-pin" | "shield-plus" | "stethoscope" | "wallet";

export function CardIconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <symbol id="ci-arrow-up-right" viewBox="0 0 24 24">
        <path d="M7 7h10v10" /><path d="M7 17 17 7" />
      </symbol>
      <symbol id="ci-building-2" viewBox="0 0 24 24">
        <path d="M10 12h4" /><path d="M10 8h4" /><path d="M14 21v-3a2 2 0 0 0-4 0v3" /><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" /><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      </symbol>
      <symbol id="ci-map-pin" viewBox="0 0 24 24">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" />
      </symbol>
      <symbol id="ci-shield-plus" viewBox="0 0 24 24">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M9 12h6" /><path d="M12 9v6" />
      </symbol>
      <symbol id="ci-stethoscope" viewBox="0 0 24 24">
        <path d="M11 2v2" /><path d="M5 2v2" /><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" /><path d="M8 15a6 6 0 0 0 12 0v-3" /><circle cx="20" cy="10" r="2" />
      </symbol>
      <symbol id="ci-wallet" viewBox="0 0 24 24">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </symbol>
    </svg>
  );
}

export function CardIcon({
  name,
  size = 24,
  strokeWidth = 2,
  className,
}: {
  name: CardIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <use href={`#ci-${name}`} />
    </svg>
  );
}
