import type { Job } from "@/lib/jobs";
import { foldText } from "@/lib/display-title";
import { knownContract, shortDate, deadlineLabel, SCHEDULE_AS_CONTRACT } from "@/lib/job-display";
import {
  extractCedula,
  extractExperience,
  extractSchedule,
  extractVenue,
  jobFullText,
  locationLabel,
  sectorLabel,
} from "@/lib/job-facts";
import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";

type Fact = { label: string; value: string };

/** Linhas do resumo: só campos com valor; vazio se houver menos de 2. */
export function buildJobFacts(job: Job): Fact[] {
  const text = jobFullText(job);
  const type = classifyJob(job);
  const deadline = deadlineLabel(job.expiresAt);
  const contract = knownContract(job);
  const rows: [string, string | null][] = [
    ["Local", locationLabel(job)],
    ["Onde vais trabalhar", extractVenue(text, job.company, job.sector)],
    ["Horário", extractSchedule(text, job.contract)],
    ["Contrato", contract && !SCHEDULE_AS_CONTRACT.test(foldText(contract).trim()) ? contract : null],
    ["Experiência", extractExperience(text)],
    ["Cédula / Ordem", extractCedula(text)],
    ["Setor", sectorLabel(job)],
    ["Tipo", type !== "oferta" ? JOB_TYPE_LABEL[type] : null],
    ["Prazo", deadline ? deadline.replace(/^Até /, "") : null],
    ["Publicada", shortDate(job.publishedAt)],
  ];
  const facts = rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  return facts.length >= 2 ? facts : [];
}

export function JobSummary({ job }: { job: Job }) {
  const facts = buildJobFacts(job);
  if (facts.length === 0) return null;
  return (
    <section aria-labelledby="job-resumo">
      <h2 id="job-resumo" className="sr-only">
        Resumo
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
