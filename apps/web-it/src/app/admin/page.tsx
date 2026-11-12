import Link from "next/link";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileWarning,
  Rss,
} from "lucide-react";
import { listAlerts } from "@/lib/alerts";
import { getJobs } from "@/lib/jobs-data";
import { getJobStats } from "@/lib/job-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [alerts, jobs, stats] = await Promise.all([
    listAlerts(),
    getJobs(),
    getJobStats(),
  ]);

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Operatività</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
              Panoramica
            </h1>
            <p className="mt-1 text-sm text-muted">
              Stato attuale della piattaforma Offerte Sanità.
            </p>
          </div>
          <a href="/" target="_blank" className="button button-secondary">
            Vai al sito <ExternalLink size={16} />
          </a>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={BriefcaseBusiness}
            label="Offerte pubblicate"
            value={stats.published || jobs.length}
            detail={
              Object.entries(stats.bySource)
                .map(([source, total]) => `${source}: ${total}`)
                .join(" · ") || "Nessuno scraper attivo"
            }
          />
          <MetricCard
            icon={FileWarning}
            label="In revisione"
            value={stats.pendingReview}
            detail={stats.pendingReview ? "Richiede attenzione" : "Nessuna in attesa"}
          />
          <MetricCard
            icon={Bell}
            label="Avvisi attivi"
            value={alerts.length}
            detail="Iscritti"
          />
          <MetricCard
            icon={Activity}
            label="Stato del sito"
            value="Online"
            detail={
              stats.updatedAt && stats.updatedAt !== new Date(0).toISOString()
                ? `Dati: ${new Date(stats.updatedAt).toLocaleString("it-IT")}`
                : "Tutti i sistemi operativi"
            }
            healthy
          />
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="content-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-extrabold">Offerte recenti</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Ultime opportunità pubblicate
                </p>
              </div>
              <Link className="text-sm font-bold text-primary" href="/admin/offerte">
                Vedi tutte
              </Link>
            </div>
            <div className="divide-y divide-border">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.slug}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-bold">{job.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {job.company} · {job.city}
                    </p>
                  </div>
                  <span className="tag tag-primary w-fit">Pubblicata</span>
                </div>
              ))}
            </div>
          </section>

          <section className="content-card p-5">
            <h2 className="font-extrabold">Stato del sistema</h2>
            <div className="mt-5 space-y-4">
              <SystemRow icon={CheckCircle2} label="Applicazione" state="Online" />
              <SystemRow
                icon={Database}
                label="Dati"
                state={
                  stats.published ? `${stats.published} pubblicate` : "Seed"
                }
              />
              <SystemRow
                icon={Rss}
                label="Fonti"
                state={
                  Object.keys(stats.bySource).length
                    ? Object.keys(stats.bySource).join(", ")
                    : "In attesa di scraping"
                }
                muted={!Object.keys(stats.bySource).length}
              />
              <SystemRow
                icon={Clock3}
                label="Email / Resend"
                state="Da configurare"
                muted
              />
            </div>
            <p className="mt-6 rounded-xl bg-primary-soft p-3 text-xs leading-5 text-muted">
              Fonti attive: nessuna per ora (da definire dopo la ricerca, vedi docs/it/).
              Storico in /admin/scrapers.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  healthy = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  detail: string;
  healthy?: boolean;
}) {
  return (
    <article className="content-card p-5">
      <div className="flex items-start justify-between">
        <span className="feature-icon h-10 w-10">
          <Icon size={19} />
        </span>
        {healthy && <span className="h-2.5 w-2.5 rounded-full bg-success" />}
      </div>
      <p className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </article>
  );
}

function SystemRow({
  icon: Icon,
  label,
  state,
  muted = false,
}: {
  icon: typeof Activity;
  label: string;
  state: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={17} className={muted ? "text-muted" : "text-success"} />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted">{state}</span>
    </div>
  );
}
