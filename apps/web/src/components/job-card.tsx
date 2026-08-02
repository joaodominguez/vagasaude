import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  MapPin,
  ShieldPlus,
  Stethoscope,
} from "lucide-react";
import type { Job } from "@/lib/jobs";

function JobIcon({ profession }: { profession: string }) {
  const Icon =
    profession === "Medicina"
      ? Stethoscope
      : profession === "Enfermagem"
        ? Building2
        : ShieldPlus;

  return (
    <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
      <Icon size={24} strokeWidth={1.8} />
    </span>
  );
}

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/vagas/${job.slug}`} className="job-card group">
      <JobIcon profession={job.profession} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold tracking-[-0.02em] text-foreground group-hover:text-primary">
          {job.title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {job.company}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} />
            {job.city}
          </span>
          <span className="tag tag-primary">{job.sector}</span>
          <span className="tag">{job.contract}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end justify-between self-stretch text-xs text-muted">
        {job.publishedLabel}
        <ArrowUpRight
          size={18}
          className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </span>
    </Link>
  );
}
