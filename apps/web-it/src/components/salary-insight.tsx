import Link from "next/link";
import type { Job } from "@/lib/jobs";
import { careerEntry, careerForProfession, formatEurRound } from "@/lib/salary-tables";

type Props = {
  job: Pick<Job, "title" | "profession" | "sector" | "salary">;
};

/**
 * Scheda offerta: (1) retribuzione indicata nell'annuncio, se c'è (verde);
 * (2) riferimento del contratto pubblico SSN per la professione (ambra),
 * sempre etichettato come NON retribuzione di questa offerta né media.
 * Il riferimento non finisce mai nel JSON-LD (vedi buildBaseSalaryJsonLd).
 */
export function SalaryInsight({ job }: Props) {
  const announced = job.salary?.trim() || null;
  const career = careerForProfession(job.profession);
  const entry = career ? careerEntry(career) : null;
  const isPublic = job.sector === "Pubblico";

  if (!announced && !career) return null;

  return (
    <div className="grid gap-3">
      {announced ? (
        <div className="salary-announced">
          <span className="salary-announced-kicker">Retribuzione indicata nell&apos;offerta</span>
          <span className="salary-announced-value">{announced}</span>
        </div>
      ) : null}
      {career && entry ? (
        <div className="salary-reference">
          <span className="salary-reference-kicker">Riferimento retributivo SSN</span>
          <p className="text-sm leading-6 text-foreground">
            <strong>Non è la retribuzione di questa offerta</strong> e non è una media.{" "}
            {isPublic ? "Nel" : "Per confronto, nel"} SSN {career.ssn.role} parte da{" "}
            <strong>~{formatEurRound(entry.monthlyEquivalent)} lordi al mese</strong> ({career.ssn.contract}),
            13ª inclusa.
            {isPublic
              ? ""
              : " Questa offerta non è del SSN: si applicano altri contratti, con importi diversi."}
          </p>
          <Link
            href={`/stipendi/${career.slug}`}
            className="text-sm font-bold text-primary hover:underline"
          >
            Vedi la tabella completa →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
