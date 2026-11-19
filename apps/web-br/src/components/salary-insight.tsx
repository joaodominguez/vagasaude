import type { Job } from "@/lib/jobs";

type Props = {
  job: Pick<Job, "salary">;
};

/** Remuneração indicada na própria vaga (quando a fonte a publica). */
export function SalaryInsight({ job }: Props) {
  const announced = job.salary?.trim() || null;
  if (!announced) return null;
  return (
    <div className="salary-announced">
      <span className="salary-announced-kicker">Remuneração indicada na vaga</span>
      <span className="salary-announced-value">{announced}</span>
    </div>
  );
}
