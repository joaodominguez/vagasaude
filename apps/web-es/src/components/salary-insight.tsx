import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { CardIcon } from "@/components/card-icons";
import type { Job } from "@/lib/jobs";
import { announcedSalaryLabel } from "@/lib/job-display";
import { careerForProfession } from "@/lib/salary-tables";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";

type Props = {
  job: Pick<Job, "title" | "profession" | "sector" | "salary">;
  /** compact = línea corta (cards); full = bloque en la ficha */
  variant?: "full" | "compact";
};

export function SalaryInsight({ job, variant = "full" }: Props) {
  const benchmark = getSalaryBenchmark(job.profession, job.title, job.sector);
  const announced = announcedSalaryLabel(job.salary) ?? (job.salary?.trim() || null);
  const isFloor = benchmark?.kind === "floor";
  const career = careerForProfession(job.profession);

  if (variant === "compact") {
    if (!benchmark) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <CardIcon name="wallet" size={12} className="shrink-0 opacity-70" />
        <span>
          {isFloor ? "Mín. convenio" : "Media de la profesión"} · {formatEuro(benchmark.average)}
          <span className="sr-only">
            {" "}
            brutos/mes (total anual entre 12) para {benchmark.label}
            {isFloor ? "" : ` (${formatEuroRange(benchmark.low, benchmark.high)})`}
          </span>
        </span>
      </span>
    );
  }

  return (
    <>
      {announced && (
        <div className="salary-announced">
          <span className="salary-announced-kicker">Retribución indicada en la oferta</span>
          <span className="salary-announced-value">{announced}</span>
        </div>
      )}
      {benchmark && (
        <div className="salary-ref">
          <span className="salary-ref-kicker">Referencia salarial · no es de esta oferta</span>
          <span className="salary-ref-value">
            {isFloor ? "" : "≈ "}
            {formatEuro(benchmark.average)} <small>brutos/mes</small>
          </span>
          <p>
            {benchmark.label}
            {isFloor ? (
              <> · sueldo base mínimo de convenio; el real suele ser mayor</>
            ) : (
              <> · normalmente {formatEuroRange(benchmark.low, benchmark.high)}</>
            )}
            . Total anual ÷ 12 (pagas extra prorrateadas).
          </p>
          <p className="salary-ref-source">
            <CircleHelp size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{benchmark.source}</span>
          </p>
          {career && (
            <Link href={`/salarios/${career.slug}`} prefetch={false}>
              Ver tabla salarial completa
            </Link>
          )}
        </div>
      )}
    </>
  );
}
