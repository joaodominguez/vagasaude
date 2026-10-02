import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="VagaSaúde — página inicial"
      className="inline-flex items-center gap-2.5"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 42 36"
        className="h-8 w-9 shrink-0"
      >
        <path
          d="M2 5.5h9.3l9.2 19.1L31.8 1h8.8L23.5 35h-7.1L2 5.5Z"
          fill="currentColor"
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
          Vaga<span className="text-primary">Saúde</span>
        </span>
      )}
    </Link>
  );
}
