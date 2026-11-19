import type { Job } from "@/lib/jobs";
import { knownContract, shortDate, deadlineLabel } from "@/lib/job-display";
import {
  extractExperience,
  extractSchedule,
  extractVenue,
  jobFullText,
  locationLabel,
  sectorLabel,
} from "@/lib/job-facts";
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";

type Fact = { label: string; value: string };

/** Righe del riepilogo: solo campi con valore; vuoto se meno di 2. */
export function buildJobFacts(job: Job): Fact[] {
  const text = jobFullText(job);
  const type = classifyJob(job);
  const deadline = deadlineLabel(job.expiresAt);
  const rows: [string, string | null][] = [
    ["Sede", locationLabel(job)],
    ["Dove lavorerai", extractVenue(text, job.company, isPublicJob(job))],
    ["Orario", extractSchedule(text, job.contract)],
    ["Contratto", knownContract(job) && !/^(turni|full[- ]?time|part[- ]?time)$/i.test(knownContract(job)!) ? knownContract(job) : null],
    ["Esperienza", extractExperience(text)],
    ["Settore", sectorLabel(job)],
    ["Tipo", type !== "offerta" ? JOB_TYPE_LABEL[type] : null],
    ["Scadenza", deadline ? deadline.replace(/^Scade (?:il |l')/, "") : null],
    ["Pubblicata", shortDate(job.publishedAt)],
  ];
  const facts = rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  return facts.length >= 2 ? facts : [];
}

export function JobSummary({ job }: { job: Job }) {
  const facts = buildJobFacts(job);
  if (facts.length === 0) return null;
  return (
    <section aria-labelledby="job-riepilogo">
      <h2 id="job-riepilogo" className="sr-only">
        Riepilogo
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
