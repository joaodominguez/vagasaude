import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label="Offerte Sanità — pagina iniziale"
      className="inline-flex items-center gap-2.5"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 42 36"
        className="h-8 w-9 shrink-0"
      >
        <circle
          cx="17"
          cy="19"
          r="12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-primary"
        />
        <path
          d="M29.5 7.5h4v4h4v4h-4v4h-4v-4h-4v-4h4v-4Z"
          fill="currentColor"
          className="text-accent"
        />
      </svg>
      {!compact && (
        <span className="text-[1.05rem] font-extrabold tracking-[-0.035em] text-foreground">
          Offerte <span className="text-primary">Sanità</span>
        </span>
      )}
    </Link>
  );
}
