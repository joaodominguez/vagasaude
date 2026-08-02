import { readFile } from "node:fs/promises";
import path from "node:path";
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
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Rss,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { jobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

async function getAlertCount() {
  const directory = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  try {
    const alerts = JSON.parse(
      await readFile(path.join(directory, "alerts.json"), "utf8"),
    ) as unknown[];
    return alerts.length;
  } catch {
    return 0;
  }
}

export default async function AdminPage() {
  const alertCount = await getAlertCount();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-border bg-surface p-5 lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="tag tag-primary">Admin</span>
        </div>
        <nav className="mt-8 grid grid-cols-2 gap-1 text-sm lg:grid-cols-1">
          <AdminLink icon={LayoutDashboard} active>
            Visão geral
          </AdminLink>
          <AdminLink icon={BriefcaseBusiness}>Vagas</AdminLink>
          <AdminLink icon={Rss}>Fontes</AdminLink>
          <AdminLink icon={RefreshCw}>Scrapers</AdminLink>
          <AdminLink icon={Bell}>Alertas</AdminLink>
          <AdminLink icon={Settings}>Sistema</AdminLink>
        </nav>
        <Link
          href="/"
          className="mt-8 hidden items-center gap-2 text-sm font-bold text-muted hover:text-primary lg:flex"
        >
          <LogOut size={16} /> Voltar ao site
        </Link>
      </aside>

      <main className="p-5 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Operação</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
                Bom dia, administrador
              </h1>
              <p className="mt-1 text-sm text-muted">
                Estado atual da plataforma VagaSaúde.
              </p>
            </div>
            <a
              href="/"
              target="_blank"
              className="button button-secondary"
            >
              Ver site <ExternalLink size={16} />
            </a>
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={BriefcaseBusiness}
              label="Vagas publicadas"
              value={jobs.length}
              detail="+2 hoje"
            />
            <MetricCard
              icon={FileWarning}
              label="Em revisão"
              value={0}
              detail="Sem pendentes"
            />
            <MetricCard
              icon={Bell}
              label="Alertas ativos"
              value={alertCount}
              detail="Subscritores"
            />
            <MetricCard
              icon={Activity}
              label="Estado do site"
              value="Online"
              detail="Todos os sistemas"
              healthy
            />
          </section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="content-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-extrabold">Vagas recentes</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Últimas oportunidades publicadas
                  </p>
                </div>
                <Link className="text-sm font-bold text-primary" href="/vagas">
                  Ver todas
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
                    <span className="tag tag-primary w-fit">Publicada</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-card p-5">
              <h2 className="font-extrabold">Estado do sistema</h2>
              <div className="mt-5 space-y-4">
                <SystemRow icon={CheckCircle2} label="Aplicação" state="Online" />
                <SystemRow icon={Database} label="Dados" state="Operacional" />
                <SystemRow icon={Rss} label="Fontes" state="Demonstração" muted />
                <SystemRow icon={Clock3} label="Último backup" state="A configurar" muted />
              </div>
              <p className="mt-6 rounded-xl bg-primary-soft p-3 text-xs leading-5 text-muted">
                Os scrapers e a base de dados definitiva serão ligados na fase
                seguinte. Esta versão já permite validar toda a experiência.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminLink({
  icon: Icon,
  active = false,
  children,
}: {
  icon: typeof LayoutDashboard;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold ${
        active
          ? "bg-primary-soft text-primary"
          : "text-muted hover:bg-primary-soft hover:text-primary"
      }`}
    >
      <Icon size={17} />
      {children}
    </span>
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
