import { classifyJob, JOB_TYPE_LABEL } from "@/lib/job-type";
import type { Job } from "@/lib/jobs";

/** Etichetta del tipo (Concorso, Graduatoria…). Non viene mostrata per le offerte normali. */
export function JobTypeBadge({ job }: { job: Job }) {
  const type = classifyJob(job);
  if (type === "offerta") return null;
  return <span className="tag tag-accent">{JOB_TYPE_LABEL[type]}</span>;
}
