import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getJobCard, getStoredJobById, type StoredJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

// Sola lettura: mostra il record completo di un'offerta così come è salvato.
const LOCALE = "it-IT";
const TIME_ZONE = "Europe/Rome";
const JOB_PATH = "/offerte/";
const LIST_PATH = "/admin/offerte";

const STATUS_LABEL: Record<StoredJob["status"], string> = {
  published: "Pubblicata",
  pending_review: "In revisione",
  hidden: "Nascosta",
  expired: "Scaduta",
  duplicate: "Duplicata",
};

const SECTOR_LABEL: Record<StoredJob["sector"], string> = {
  pubblico: "Pubblico",
  privato: "Privato",
  accreditato: "Accreditato",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getStoredJobById(decodeURIComponent(id));
  if (!found) notFound();
  const { job, sameHash } = found;
  const onSite = await getJobCard(job.slug);

  let siteState: string;
  if (!onSite) {
    siteState = "Non compare sul sito (l'URL restituisce 404).";
  } else if (onSite.expired) {
    siteState = "Pagina visibile come offerta scaduta (fuori da elenchi e sitemap).";
  } else if (onSite.canonicalSlug) {
    siteState = `Attiva, ma è una ripubblicazione: il canonical punta a ${JOB_PATH}${onSite.canonicalSlug}.`;
  } else {
    siteState = "Attiva sul sito (elenchi, sitemap e Google for Jobs).";
  }

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={LIST_PATH}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
        >
          <ArrowLeft size={12} /> Torna all’elenco
        </Link>

        <header className="mt-4">
          <p className="section-kicker">Offerta</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {job.company} · {job.locationConcelho ? `${job.locationConcelho}, ` : ""}
            {job.locationDistrict}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="tag">{STATUS_LABEL[job.status] ?? job.status}</span>
            {onSite && (
              <Link
                href={`${JOB_PATH}${job.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary"
              >
                Vedi sul sito <ExternalLink size={12} />
              </Link>
            )}
            <a
              href={job.applicationUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
            >
              Fonte <ExternalLink size={12} />
            </a>
          </div>
        </header>

        <section className="content-card mt-6 p-5">
          <h2 className="text-sm font-extrabold">Stato sul sito</h2>
          <p className="mt-2 text-sm">{siteState}</p>
          {job.reviewReason && (
            <p className="mt-2 text-sm text-muted">Motivo: {job.reviewReason}</p>
          )}
        </section>

        <section className="content-card mt-4 p-5">
          <h2 className="text-sm font-extrabold">Dati</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Professione">{job.profession || "—"}</Field>
            <Field label="Specialità">{job.specialty || "—"}</Field>
            <Field label="Settore">{SECTOR_LABEL[job.sector] ?? job.sector}</Field>
            <Field label="Contratto">{job.contractType || "—"}</Field>
            <Field label="Retribuzione">{job.salary || "—"}</Field>
            <Field label="Fonte">
              {job.source} · ID {job.sourceId}
            </Field>
            <Field label="Pubblicata">{formatDate(job.publishedAt)}</Field>
            <Field label="Scadenza">{formatDate(job.expiresAt)}</Field>
            <Field label="Ultima volta vista nella fonte">{formatDate(job.lastSeenAt)}</Field>
            <Field label="Entrata nel sito">{formatDate(job.createdAt)}</Field>
            <Field label="Ultima modifica">{formatDate(job.updatedAt)}</Field>
            <Field label="Slug (URL)">
              <span className="font-mono text-xs">{job.slug}</span>
            </Field>
            <Field label="Link di candidatura">
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-mono text-xs text-primary"
              >
                {job.applicationUrl}
              </a>
            </Field>
            <Field label="ID interno">
              <span className="font-mono text-xs">{job.id}</span>
            </Field>
          </dl>
        </section>

        <section className="content-card mt-4 p-5">
          <h2 className="text-sm font-extrabold">Descrizione</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {job.description || "—"}
          </div>
        </section>

        {job.requirements && (
          <section className="content-card mt-4 p-5">
            <h2 className="text-sm font-extrabold">Requisiti</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {job.requirements}
            </div>
          </section>
        )}

        {sameHash.length > 0 && (
          <section className="content-card mt-4 overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-extrabold">
              Stessa offerta in altri record ({sameHash.length})
            </h2>
            <div className="mt-3 divide-y divide-border">
              {sameHash.map((other) => (
                <Link
                  key={other.id}
                  href={`${LIST_PATH}/${encodeURIComponent(other.id)}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-surface"
                >
                  <span className="min-w-0 truncate">
                    {other.title} <span className="text-muted">· {other.source}</span>
                  </span>
                  <span className="tag">{STATUS_LABEL[other.status] ?? other.status}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <details className="content-card mt-4 p-5">
          <summary className="cursor-pointer text-sm font-extrabold">
            Record completo (come salvato)
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(job, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
