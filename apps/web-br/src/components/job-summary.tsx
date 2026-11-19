import type { Job } from "@/lib/jobs";
import { knownContract, shortDate, deadlineLabel } from "@/lib/job-display";
import {
  extractCouncil,
  extractExperience,
  extractSchedule,
  extractVenue,
  jobFullText,
  locationLabel,
  sectorLabel,
} from "@/lib/job-facts";
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";

type Fact = { label: string; value: string };

/** Linhas do resumo: só campos com valor; vazio se houver menos de 2. */
export function buildJobFacts(job: Job): Fact[] {
  const text = jobFullText(job);
  const type = classifyJob(job);
  const deadline = deadlineLabel(job.expiresAt);
  const contract = knownContract(job);
  const rows: [string, string | null][] = [
    ["Local", locationLabel(job)],
    ["Onde você vai trabalhar", extractVenue(text, job.company, isPublicJob(job))],
    ["Horário", extractSchedule(text, job.contract)],
    ["Contrato", contract && !/^(plant[aã]o|turnos?|diarista|meio per[ií]odo|tempo integral)$/i.test(contract) ? contract : null],
    ["Experiência", extractExperience(text)],
    ["Registro", extractCouncil(text)],
    ["Setor", sectorLabel(job)],
    ["Tipo", type !== "oferta" ? JOB_TYPE_LABEL[type] : null],
    ["Prazo", deadline ? deadline.replace(/^Inscrições até /, "") : null],
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
