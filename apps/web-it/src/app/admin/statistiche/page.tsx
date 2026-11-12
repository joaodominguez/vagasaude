import { getRecentDays, type DayStats } from "@/lib/site-stats";

export const dynamic = "force-dynamic";

const LOCALE = "it-IT";
const L = {
  kicker: "Utilizzo",
  title: "Statistiche",
  subtitle: "Ultimi 30 giorni · senza cookie, dati aggregati (UTC)",
  pageviews: "Pagine viste",
  uniques: "Visitatori unici",
  applyClicks: "Clic su candidatura",
  applyRate: "Tasso di candidatura",
  applyRateHint: "clic ÷ visitatori unici",
  daily: "Pagine viste al giorno",
  topPages: "Pagine più viste",
  referrers: "Origini del traffico",
  countries: "Paesi",
  devices: "Dispositivi",
  topJobs: "Offerte con più clic su candidatura",
  campaigns: "Campagne UTM",
  sourceMedium: "Origine / mezzo",
  empty: "Ancora nessun dato.",
  direct: "Diretto / sconosciuto",
  other: "Altri",
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  views: "visualizzazioni",
  unknownCountry: "Sconosciuto",
  jobPath: "/offerte/",
};

const REFERRER_GROUPS: Array<[string, RegExp]> = [
  ["Google", /(^|\.)google\./],
  ["Bing", /(^|\.)bing\.com$/],
  ["DuckDuckGo", /duckduckgo\.com$/],
  ["Ecosia", /ecosia\.org$/],
  ["ChatGPT", /chatgpt\.com$|openai\.com$/],
  ["Perplexity", /perplexity\.ai$/],
  ["Gemini", /gemini\.google\.com$/],
  ["Facebook", /(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$/],
  ["Instagram", /instagram\.com$/],
  ["LinkedIn", /linkedin\.com$|^lnkd\.in$/],
  ["X / Twitter", /(^|\.)(twitter|x)\.com$|^t\.co$/],
  ["WhatsApp", /whatsapp\.com$/],
  ["Email", /mail\.|outlook\.|gmail\./],
];

function groupReferrer(host: string) {
  if (host === "(altri)") return L.other;
  for (const [label, re] of REFERRER_GROUPS) if (re.test(host)) return label;
  return host;
}

function sumMaps(days: DayStats[], pick: (d: DayStats) => Record<string, number>) {
  const out: Record<string, number> = {};
  for (const day of days) {
    for (const [key, n] of Object.entries(pick(day))) out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

function top(map: Record<string, number>, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

const nf = new Intl.NumberFormat(LOCALE);

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="content-card p-5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Table({
  title,
  rows,
  head,
}: {
  title: string;
  rows: Array<[string, number]>;
  head?: string;
}) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <section className="content-card p-5">
      <h2 className="text-base font-extrabold">{title}</h2>
      {head && <p className="mt-0.5 text-xs text-muted">{head}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{L.empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map(([label, n]) => (
            <li key={label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium" title={label}>
                  {label}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{nf.format(n)}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-primary-soft">
                <div
                  className="h-1 rounded-full bg-primary"
                  style={{ width: `${Math.max(2, (n / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DailyChart({ days }: { days: Array<{ date: string; stats: DayStats }> }) {
  const W = 720;
  const H = 180;
  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const max = Math.max(1, ...days.map((d) => d.stats.pageviews));
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / days.length;
  const bar = Math.max(2, slot - 3);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 h-auto w-full"
      role="img"
      aria-label={L.daily}
    >
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
        const h = (d.stats.pageviews / max) * innerH;
        const x = pad.l + i * slot + (slot - bar) / 2;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={pad.t + innerH - h}
              width={bar}
              height={Math.max(h, d.stats.pageviews ? 1 : 0)}
              rx="2"
              className="fill-primary"
            >
              <title>{`${d.date}: ${nf.format(d.stats.pageviews)} ${L.views}, ${nf.format(d.stats.uniques)} ${L.uniques.toLowerCase()}`}</title>
            </rect>
            {(i === 0 || i === days.length - 1 || i % 7 === 0) && (
              <text
                x={x + bar / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                opacity="0.6"
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminStatsPage() {
  const days = getRecentDays(30);
  const stats = days.map((d) => d.stats);

  const pageviews = stats.reduce((s, d) => s + d.pageviews, 0);
  const uniques = stats.reduce((s, d) => s + d.uniques, 0);
  const apply = stats.reduce((s, d) => s + (d.events.apply_click ?? 0), 0);
  const rate = uniques ? `${((apply / uniques) * 100).toFixed(1)}%` : "—";

  const pages = top(sumMaps(stats, (d) => d.paths), 15);

  const grouped: Record<string, number> = {};
  for (const [host, n] of Object.entries(sumMaps(stats, (d) => d.referrers))) {
    const label = groupReferrer(host);
    grouped[label] = (grouped[label] ?? 0) + n;
  }
  const referred = Object.values(grouped).reduce((s, n) => s + n, 0);
  if (pageviews > referred) grouped[L.direct] = pageviews - referred;

  const countries = top(sumMaps(stats, (d) => d.countries)).map(
    ([cc, n]): [string, number] => [cc === "XX" ? L.unknownCountry : cc, n],
  );
  const devices = sumMaps(stats, (d) => ({ ...d.devices }));
  const deviceRows = (["mobile", "tablet", "desktop"] as const)
    .map((k): [string, number] => [L[k], devices[k] ?? 0])
    .filter(([, n]) => n > 0);

  const jobs = top(sumMaps(stats, (d) => d.applyBySlug), 10).map(
    ([slug, n]): [string, number] => [`${L.jobPath}${slug}`, n],
  );
  const campaigns = top(sumMaps(stats, (d) => d.campaigns));
  const utm = top(sumMaps(stats, (d) => d.utm));

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="section-kicker">{L.kicker}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">{L.title}</h1>
          <p className="mt-1 text-sm text-muted">{L.subtitle}</p>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label={L.pageviews} value={nf.format(pageviews)} />
          <Card label={L.uniques} value={nf.format(uniques)} />
          <Card label={L.applyClicks} value={nf.format(apply)} />
          <Card label={L.applyRate} value={rate} hint={L.applyRateHint} />
        </div>

        <section className="content-card mt-6 p-5">
          <h2 className="text-base font-extrabold">{L.daily}</h2>
          <DailyChart days={days} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Table title={L.topPages} rows={pages} />
          <Table title={L.referrers} rows={top(grouped)} />
          <Table title={L.topJobs} rows={jobs} />
          <Table title={L.campaigns} rows={campaigns} />
          <Table title={L.sourceMedium} rows={utm} />
          <Table title={L.countries} rows={countries} />
          <Table title={L.devices} rows={deviceRows} />
        </div>
      </div>
    </main>
  );
}
