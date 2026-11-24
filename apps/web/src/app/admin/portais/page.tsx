import { getPortalStats, type SiteSummary, type Vertical } from "@/lib/portal-stats";

export const dynamic = "force-dynamic";

const GOAL = 100_000;
const nf = new Intl.NumberFormat("pt-PT");
const VERTICALS: Array<[Vertical, string]> = [
  ["saude", "Saúde"],
  ["educacao", "Educação"],
];

function DailyChart({ days, label }: { days: SiteSummary["days"]; label: string }) {
  const W = 720;
  const H = 180;
  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const max = Math.max(1, ...days.map((d) => d.pageviews));
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / days.length;
  const bar = Math.max(2, slot - 3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="currentColor" opacity="0.12" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">
              {nf.format(Math.round(max * f))}
            </text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const h = (d.pageviews / max) * innerH;
        const x = pad.l + i * slot + (slot - bar) / 2;
        return (
          <g key={d.date}>
            <rect x={x} y={pad.t + innerH - h} width={bar} height={Math.max(h, d.pageviews ? 1 : 0)} rx="2" className="fill-primary">
              <title>{`${d.date}: ${nf.format(d.pageviews)} vis., ${nf.format(d.uniques)} visitantes únicos`}</title>
            </rect>
            {(i === 0 || i === days.length - 1 || i % 7 === 0) && (
              <text x={x + bar / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function trend(s: SiteSummary) {
  if (!s.prev7) return s.last7 ? "novo" : "—";
  const p = ((s.last7 - s.prev7) / s.prev7) * 100;
  return `${p > 0 ? "+" : ""}${p.toFixed(0)}%`;
}

function sumDays(list: SiteSummary[]) {
  const out = Array.from({ length: 30 }, (_, i) => ({
    date: list.find((s) => s.days.length)?.days[i]?.date ?? "",
    pageviews: 0,
    uniques: 0,
    applyClicks: 0,
  }));
  for (const s of list) {
    s.days.forEach((d, i) => {
      out[i].pageviews += d.pageviews;
      out[i].uniques += d.uniques;
      out[i].applyClicks += d.applyClicks;
    });
  }
  return out;
}

function Goal({ value, target = GOAL }: { value: number; target?: number }) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-primary-soft">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {nf.format(value)} / {nf.format(target)} ({((value / target) * 100).toFixed(1)}%)
      </p>
    </div>
  );
}

/** "chatgpt.com/-" → "ChatGPT", "facebook/social" → "Facebook", "vagasaude/email" → "Email". */
function sourceLabel(key: string) {
  const [src, medium] = key.split("/");
  if (medium === "email") return "Email";
  const map: Record<string, string> = {
    "chatgpt.com": "ChatGPT",
    facebook: "Facebook",
    google_jobs_apply: "Google Jobs",
    google: "Google",
    perplexity: "Perplexity",
    instagram: "Instagram",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
  };
  return map[src] ?? src;
}

function StatusNote({ s }: { s: SiteSummary }) {
  return (
    <span className="text-xs font-semibold text-amber-600">
      {s.status === "sem-acesso" ? "sem acesso" : "sem dados"}
    </span>
  );
}

export default async function AdminPortaisPage() {
  const all = await getPortalStats();
  const total = sumDays(all.filter((s) => s.status === "ok"));
  const total30 = all.reduce((s, x) => s + x.last30, 0);

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-[1440px]">
        <header>
          <p className="section-kicker">Utilização</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">Todos os portais</h1>
          <p className="mt-1 text-sm text-muted">
            Estatísticas internas dos 8 sites · dias UTC · hoje é parcial · cache de 60 s
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="content-card p-5">
            <p className="text-xs font-semibold text-muted">Total 8 sites · 30 dias</p>
            <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{nf.format(total30)}</p>
            <Goal value={total30} target={GOAL * all.length} />
          </div>
          {VERTICALS.map(([v, label]) => {
            const list = all.filter((s) => s.site.vertical === v);
            return (
              <div key={v} className="content-card p-5">
                <p className="text-xs font-semibold text-muted">{label} · 30 dias</p>
                <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
                  {nf.format(list.reduce((s, x) => s + x.last30, 0))}
                </p>
                <p className="mt-1 text-xs text-muted">
                  hoje {nf.format(list.reduce((s, x) => s + x.today, 0))} · 7 dias{" "}
                  {nf.format(list.reduce((s, x) => s + x.last7, 0))}
                </p>
                <Goal value={list.reduce((s, x) => s + x.last30, 0)} target={GOAL * list.length} />
              </div>
            );
          })}
        </section>

        <section className="content-card mt-6 overflow-x-auto p-5">
          <h2 className="text-base font-extrabold">Resumo por site</h2>
          <table className="mt-4 w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="whitespace-nowrap text-left text-xs text-muted">
                <th className="py-2 pr-3">Site</th>
                <th className="px-3 text-right">Hoje</th>
                <th className="px-3 text-right">Ontem</th>
                <th className="px-3 text-right">7 dias</th>
                <th className="px-3 text-right">30 dias</th>
                <th className="px-3 text-right" title="vs 7 dias anteriores">Δ 7d</th>
                <th className="px-3 text-right" title="Visitantes únicos hoje">Únicos</th>
                <th className="px-3 text-right" title="Cliques em candidatar, 7 dias">Cand. 7d</th>
                <th className="px-3">Fontes hoje</th>
                <th className="px-3 text-right" title="% de visitas do país do mercado, hoje">% país</th>
                <th className="pl-3 text-right" title="30 dias vs 100.000">Meta</th>
              </tr>
            </thead>
            {VERTICALS.map(([v, label]) => {
              const list = all.filter((s) => s.site.vertical === v);
              return (
                <tbody key={v}>
                  <tr>
                    <td colSpan={11} className="pt-4 text-xs font-extrabold uppercase tracking-wide text-muted">
                      {label}
                    </td>
                  </tr>
                  {list.map((s) =>
                    s.status !== "ok" ? (
                      <tr key={s.site.id} className="border-t border-black/5">
                        <td className="py-2 pr-3 font-semibold">{s.site.name}</td>
                        <td colSpan={10}>
                          <StatusNote s={s} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.site.id} className="border-t border-black/5 align-top tabular-nums [&>td]:py-2.5">
                        <td className="py-2 pr-3 font-semibold">
                          {s.site.name}
                          <span className="block text-xs font-normal text-muted">{s.site.domain}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.today)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.yesterday)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.last7)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.last30)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{trend(s)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.uniquesToday)}</td>
                        <td className="whitespace-nowrap px-3 text-right">{nf.format(s.apply7)}</td>
                        <td className="min-w-[180px] px-3 text-xs leading-5">
                          {s.topSources.length
                            ? s.topSources.map(([k, n]) => (
                                <span key={k} className="block whitespace-nowrap">
                                  {sourceLabel(k)} <span className="text-muted">{nf.format(n)}</span>
                                </span>
                              ))
                            : "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 text-right ${s.homeShare !== null && s.homeShare < 70 ? "font-bold text-amber-600" : ""}`}
                          title={
                            s.homeShare !== null && s.homeShare < 70
                              ? `Menos de 70% de ${s.site.country}: possíveis bots`
                              : undefined
                          }
                        >
                          {s.homeShare === null ? "—" : `${s.homeShare.toFixed(0)}% ${s.site.country}`}
                        </td>
                        <td className="whitespace-nowrap pl-3 text-right">{((s.last30 / GOAL) * 100).toFixed(1)}%</td>
                      </tr>
                    ),
                  )}
                </tbody>
              );
            })}
          </table>
        </section>

        <section className="content-card mt-6 p-5">
          <h2 className="text-base font-extrabold">Visualizações por dia · total dos 8 sites</h2>
          <DailyChart days={total} label="Visualizações por dia, total dos 8 sites" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {all.map((s) => (
            <section key={s.site.id} className="content-card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-extrabold">Visualizações por dia · {s.site.name}</h2>
                {s.status === "ok" ? (
                  <span className="text-xs text-muted tabular-nums">30d: {nf.format(s.last30)}</span>
                ) : (
                  <StatusNote s={s} />
                )}
              </div>
              {s.status === "ok" ? (
                <>
                  <DailyChart days={s.days} label={`Visualizações por dia, ${s.site.name}`} />
                  <Goal value={s.last30} />
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">Sem dados para mostrar.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
