import type { Job } from "@/lib/jobs";
import { foldText } from "@/lib/display-title";
import { knownContract, shortDate, deadlineLabel, SCHEDULE_AS_CONTRACT } from "@/lib/job-display";
import {
  extractColegiacion,
  extractExperience,
  extractSchedule,
  extractVenue,
  jobFullText,
  locationLabel,
  sectorLabel,
} from "@/lib/job-facts";
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";

type Fact = { label: string; value: string };

/** Filas del resumen: solo campos con valor; vacío si hay menos de 2. */
export function buildJobFacts(job: Job): Fact[] {
  const text = jobFullText(job);
  const type = classifyJob(job);
  const deadline = deadlineLabel(job.expiresAt);
  const contract = knownContract(job);
  const rows: [string, string | null][] = [
    ["Ubicación", locationLabel(job)],
    ["Dónde trabajarás", extractVenue(text, job.company, isPublicJob(job))],
    ["Horario", extractSchedule(text, job.contract)],
    ["Contrato", contract && !SCHEDULE_AS_CONTRACT.test(foldText(contract).trim()) ? contract : null],
    ["Experiencia", extractExperience(text)],
    ["Colegiación", extractColegiacion(text)],
    ["Sector", sectorLabel(job)],
    ["Tipo", type !== "oferta" ? JOB_TYPE_LABEL[type] : null],
    ["Plazo", deadline ? deadline.replace(/^Hasta el /, "") : null],
    ["Publicada", shortDate(job.publishedAt)],
  ];
  const facts = rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  return facts.length >= 2 ? facts : [];
}

export function JobSummary({ job }: { job: Job }) {
  const facts = buildJobFacts(job);
  if (facts.length === 0) return null;
  return (
    <section aria-labelledby="job-resumen">
      <h2 id="job-resumen" className="sr-only">
        Resumen
      </h2>
      <dl className="job-facts-grid">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
