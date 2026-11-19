import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { CardIcon } from "@/components/card-icons";
import type { Job } from "@/lib/jobs";
import { announcedSalaryLabel } from "@/lib/job-display";
import { careerEntry, careerForProfession } from "@/lib/salary-tables";
import {
  formatEuro,
  formatEuroRange,
  getSalaryBenchmark,
} from "@/lib/salary-benchmarks";

type Props = {
  job: Pick<Job, "title" | "profession" | "sector" | "salary">;
  /** compact = linha curta (cartões); full = bloco na ficha */
  variant?: "full" | "compact";
  /** false: só a remuneração indicada, sem a caixa de referência salarial. */
  showReference?: boolean;
};

/** «1 750 €» (espaço inseparável nos milhares, também com 4 dígitos). */
function eur(value: number) {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}\u00a0€`;
}

/** «35 horas semanais» → «35 h». */
function shortRegime(regime: string) {
  return regime.replace(/\s*horas?\s+semanais/i, " h");
}

export function SalaryInsight({ job, variant = "full", showReference = true }: Props) {
  const benchmark = getSalaryBenchmark(job.profession, job.title, job.sector);
  const announced = announcedSalaryLabel(job.salary) ?? (job.salary?.trim() || null);
  const career = careerForProfession(job.profession);

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <CardIcon name="wallet" size={12} className="shrink-0 opacity-70" />
        <span>
          Média da profissão · {formatEuro(benchmark.average)}
          <span className="sr-only">
            {" "}
            brutos/mês para {benchmark.label} ({formatEuroRange(benchmark.low, benchmark.high)})
          </span>
        </span>
      </span>
    );
  }

  const entry = career ? careerEntry(career) : null;

  return (
    <>
      {announced && (
        <div className="salary-announced">
          <span className="salary-announced-kicker">Remuneração indicada na vaga</span>
          <span className="salary-announced-value">{announced}</span>
        </div>
      )}
      {showReference && (
        <div className="salary-ref">
          <span className="salary-ref-kicker">Referência salarial · não é desta vaga</span>
          <span className="salary-ref-value">
            ≈ {eur(benchmark.average)} <small>brutos/mês</small>
          </span>
          <p>
            {benchmark.label} · valor médio de mercado em Portugal (tipicamente{" "}
            {eur(benchmark.low)} – {eur(benchmark.high)}).
            {career && entry && (
              <>
                {" "}
                No SNS, a carreira de {career.label} começa nos {eur(entry.gross)}{" "}
                ({shortRegime(career.regime)}).
              </>
            )}
          </p>
          <p className="salary-ref-source">
            <CircleHelp size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{benchmark.source}</span>
          </p>
          {career && (
            <Link href={`/salarios/${career.slug}`} prefetch={false}>
              Ver tabela salarial completa
            </Link>
          )}
        </div>
      )}
    </>
  );
}
