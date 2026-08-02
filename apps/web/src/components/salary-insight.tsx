import { CircleHelp, Wallet } from "lucide-react";
import type { Job } from "@/lib/jobs";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";

type Props = {
  job: Pick<Job, "title" | "profession" | "sector" | "salary">;
  /** compact = linha curta (cards); full = bloco na ficha */
  variant?: "full" | "compact";
};

export function SalaryInsight({ job, variant = "full" }: Props) {
  const benchmark = getSalaryBenchmark(job.profession, job.title, job.sector);
  const announced = job.salary?.trim() || null;

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Wallet size={12} className="shrink-0 opacity-70" aria-hidden="true" />
        <span>
          Média PT · {formatEuro(benchmark.average)}
          <span className="sr-only">
            {" "}
            brutos/mês para {benchmark.label} ({formatEuroRange(benchmark.low, benchmark.high)})
          </span>
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-primary-soft/40 px-3 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
          <Wallet size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Vencimento médio em Portugal
          </p>
          <p className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-foreground">
            {formatEuro(benchmark.average)}
            <span className="ml-1 text-sm font-semibold text-muted">
              brutos/mês
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {benchmark.label} · tipicamente{" "}
            {formatEuroRange(benchmark.low, benchmark.high)}
          </p>
          {announced ? (
            <p className="mt-2 text-xs leading-5 text-foreground">
              <span className="font-semibold">Nesta vaga: </span>
              <span className="text-muted">{announced}</span>
            </p>
          ) : null}
          <p className="mt-2 flex items-start gap-1 text-[11px] leading-4 text-muted">
            <CircleHelp size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{benchmark.source}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
