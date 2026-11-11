import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getJobCard, getStoredJobById, type StoredJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

// Só leitura: mostra o registo completo de uma vaga tal como está guardado.
const LOCALE = "pt-PT";
const TIME_ZONE = "Europe/Lisbon";
const JOB_PATH = "/vagas/";
const LIST_PATH = "/admin/vagas";

const STATUS_LABEL: Record<StoredJob["status"], string> = {
  published: "Publicada",
  pending_review: "Em revisão",
  hidden: "Oculta",
  expired: "Expirada",
  duplicate: "Duplicada",
};

const SECTOR_LABEL: Record<StoredJob["sector"], string> = {
  publico: "Público",
  privado: "Privado",
  ipss: "IPSS",
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
    siteState = "Não aparece no site (o URL dá 404).";
  } else if (onSite.expired) {
    siteState = "Página visível como vaga expirada (fora das listagens e do sitemap).";
  } else if (onSite.canonicalSlug) {
    siteState = `Ativa, mas é uma republicação: o canonical aponta para ${JOB_PATH}${onSite.canonicalSlug}.`;
  } else {
    siteState = "Ativa no site (listagens, sitemap e Google for Jobs).";
  }

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={LIST_PATH}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
        >
          <ArrowLeft size={12} /> Voltar à lista
        </Link>

        <header className="mt-4">
          <p className="section-kicker">Vaga</p>
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
                Ver no site <ExternalLink size={12} />
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
          <h2 className="text-sm font-extrabold">Estado no site</h2>
          <p className="mt-2 text-sm">{siteState}</p>
          {job.reviewReason && (
            <p className="mt-2 text-sm text-muted">Motivo: {job.reviewReason}</p>
          )}
        </section>

        <section className="content-card mt-4 p-5">
          <h2 className="text-sm font-extrabold">Dados</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Profissão">{job.profession || "—"}</Field>
            <Field label="Especialidade">{job.specialty || "—"}</Field>
            <Field label="Setor">{SECTOR_LABEL[job.sector] ?? job.sector}</Field>
            <Field label="Contrato">{job.contractType || "—"}</Field>
            <Field label="Salário">{job.salary || "—"}</Field>
            <Field label="Fonte">
              {job.source} · ID {job.sourceId}
            </Field>
            <Field label="Publicada">{formatDate(job.publishedAt)}</Field>
            <Field label="Prazo">{formatDate(job.expiresAt)}</Field>
            <Field label="Última vez vista na fonte">{formatDate(job.lastSeenAt)}</Field>
            <Field label="Entrou no site">{formatDate(job.createdAt)}</Field>
            <Field label="Última alteração">{formatDate(job.updatedAt)}</Field>
            <Field label="Slug (URL)">
              <span className="font-mono text-xs">{job.slug}</span>
            </Field>
            <Field label="Link de candidatura">
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
          <h2 className="text-sm font-extrabold">Descrição</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {job.description || "—"}
          </div>
        </section>

        {job.requirements && (
          <section className="content-card mt-4 p-5">
            <h2 className="text-sm font-extrabold">Requisitos</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {job.requirements}
            </div>
          </section>
        )}

        {sameHash.length > 0 && (
          <section className="content-card mt-4 overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-extrabold">
              Mesma vaga noutros registos ({sameHash.length})
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
            Registo completo (como está guardado)
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(job, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
