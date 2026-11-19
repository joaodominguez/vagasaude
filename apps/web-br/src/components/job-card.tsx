import Link from "next/link";
import type { Job } from "@/lib/jobs";
import { FavoriteButton } from "@/components/favorite-button";
import { JobIcon } from "@/components/profession-icon";
import { compactBandoTitle, displayTitle } from "@/lib/display-title";
import {
  announcedSalaryLabel,
  contractBesideType,
  deadlineLabel,
  relativePublished,
} from "@/lib/job-display";
import { extractSchedule, shiftChipLabel, specialtyFromTitle } from "@/lib/job-facts";
import { isConcursoJob } from "@/lib/concursos";
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";

/** Cartão da vaga: título limpo, «Entidade · Cidade · quando», etiquetas e (se houver) remuneração. */
export function JobCard({ job }: { job: Job }) {
  const type = classifyJob(job);
  const isEdital = type !== "oferta";
  const cleaned = displayTitle(job.title, job);
  const compact = isEdital ? compactBandoTitle(cleaned) : { title: cleaned, posts: null };
  const contract = contractBesideType(job);
  // Em editais agregados (PCI/INCA) o valor pode ser de outro cargo ou taxa de inscrição.
  const salary = isConcursoJob(job) ? null : announcedSalaryLabel(job.salary);
  const published = relativePublished(job.publishedAt);
  const deadline = deadlineLabel(job.expiresAt);
  const isPublic = isPublicJob(job);
  // A lista em memória não traz a descrição: a escala só aparece quando o título a diz.
  const shift = isEdital
    ? null
    : shiftChipLabel(extractSchedule(`${job.title}\n${job.description}`, job.contract));
  const specialty = specialtyFromTitle(job.title);
  const meta = [job.company, job.city, published].filter(Boolean).join(" · ");

  return (
    <Link href={`/vagas/${job.slug}`} className="job-card group">
      <span className="flex min-w-0 items-start gap-3">
        <JobIcon profession={job.profession} concorso={isEdital} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block break-words font-bold leading-snug tracking-[-0.02em] text-foreground group-hover:text-primary">
                {compact.title}
              </span>
              <span className="mt-0.5 block break-words text-sm leading-snug text-muted">{meta}</span>
            </span>
            <FavoriteButton slug={job.slug} size={18} />
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {isPublic ? (
              <span className="tag tag-public">Público</span>
            ) : (
              <span className="tag">{job.sector === "Filantrópico" ? "Filantrópico" : "Privado"}</span>
            )}
            {isEdital && <span className="tag">{JOB_TYPE_LABEL[type]}</span>}
            {compact.posts && (
              <span className="tag">{compact.posts === 1 ? "1 vaga" : `${compact.posts} vagas`}</span>
            )}
            {shift && <span className="tag tag-primary">{shift}</span>}
            {!shift && specialty && <span className="tag tag-primary">{specialty}</span>}
            {contract && <span className="tag">{contract}</span>}
            {deadline && <span className="tag tag-deadline">{deadline}</span>}
            {salary && <span className="tag tag-salary">{salary}</span>}
          </span>
        </span>
      </span>
    </Link>
  );
}
