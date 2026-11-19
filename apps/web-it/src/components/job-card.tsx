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
import { extractSchedule, specialtyFromTitle } from "@/lib/job-facts";
import { classifyJob, isPublicJob, JOB_TYPE_LABEL } from "@/lib/job-type";

/** Scheda dell'offerta: titolo pulito, «Ente · Città · quando», chip e (se c'è) retribuzione. */
export function JobCard({ job }: { job: Job }) {
  const type = classifyJob(job);
  const isBando = type !== "offerta";
  const cleaned = displayTitle(job.title, job);
  const compact = isBando ? compactBandoTitle(cleaned) : { title: cleaned, posts: null };
  const contract = contractBesideType(job);
  const salary = announcedSalaryLabel(job.salary);
  const published = relativePublished(job.publishedAt);
  const deadline = deadlineLabel(job.expiresAt);
  const isPublic = isPublicJob(job);
  const schedule = isBando ? null : extractSchedule(`${job.title}\n${job.description}`, job.contract);
  const shift = schedule && /turni/i.test(schedule) ? "Turni" : null;
  const specialty = specialtyFromTitle(job.title);
  const meta = [job.company, job.city, published].filter(Boolean).join(" · ");

  return (
    <Link href={`/offerte/${job.slug}`} className="job-card group">
      <span className="flex min-w-0 items-start gap-3">
        <JobIcon profession={job.profession} concorso={isBando} />
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
              <span className="tag tag-public">Pubblico</span>
            ) : (
              <span className="tag">{job.sector === "Accreditato" ? "Accreditato" : "Privato"}</span>
            )}
            {isBando && <span className="tag">{JOB_TYPE_LABEL[type]}</span>}
            {compact.posts && (
              <span className="tag">{compact.posts === 1 ? "1 posto" : `${compact.posts} posti`}</span>
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
