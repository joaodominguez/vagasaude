import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";

/** Etiqueta de tipo (Concurso, Bolsa de recrutamento…). Não se mostra para ofertas normais. */
export function JobTypeBadge({ job }: { job: Job }) {
  const type = classifyJob(job);
  if (type === "oferta") return null;
  return <span className="tag tag-accent">{JOB_TYPE_LABEL[type]}</span>;
}
