import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Estatísticas agregadas dos 8 portais (só leitura, só servidor).
 * Lê /var/www/<pasta>/data/site-stats.json de cada site, com cache de ~60 s.
 * Lista configurável: PORTAL_STATS_SITES = "id|nome|país|vertical|caminho;..."
 */

export type Vertical = "saude" | "educacao";

export type PortalSite = {
  id: string;
  name: string;
  domain: string;
  country: string;
  vertical: Vertical;
  file: string;
};

const DEFAULT_SITES: PortalSite[] = [
  ["vagasaude", "VagaSaúde PT", "vagasaude.pt", "PT", "saude"],
  ["vagasaudebr", "VagaSaúde BR", "vagasaude.com.br", "BR", "saude"],
  ["vacantessalud", "VacantesSalud ES", "vacantessalud.es", "ES", "saude"],
  ["offertesanita", "OfferteSanità IT", "offertesanita.it", "IT", "saude"],
  ["vagaeducacao", "VagaEducação PT", "vagaeducacao.pt", "PT", "educacao"],
  ["vagaeducacaobr", "VagaEducação BR", "vagaeducacao.com.br", "BR", "educacao"],
  ["vacanteseducacion", "VacantesEducación ES", "vacanteseducacion.es", "ES", "educacao"],
  ["offertescuola", "OfferteScuola IT", "offertescuola.it", "IT", "educacao"],
].map(([dir, name, domain, country, vertical]) => ({
  id: dir,
  name,
  domain,
  country,
  vertical: vertical as Vertical,
  file: `/var/www/${dir}/data/site-stats.json`,
}));

/** PORTAL_STATS_SITES: "id|nome|domínio|país|vertical|ficheiro" separados por ";" */
function configuredSites(): PortalSite[] {
  const raw = process.env.PORTAL_STATS_SITES?.trim();
  if (!raw) return DEFAULT_SITES;
  const parsed = raw
    .split(";")
    .map((s) => s.split("|").map((p) => p.trim()))
    .filter((p) => p.length === 6 && p[5])
    .map(([id, name, domain, country, vertical, file]) => ({
      id,
      name,
      domain,
      country,
      vertical: (vertical === "educacao" ? "educacao" : "saude") as Vertical,
      file: path.resolve(file),
    }));
  return parsed.length ? parsed : DEFAULT_SITES;
}

export type DayRow = {
  date: string;
  pageviews: number;
  uniques: number;
  applyClicks: number;
};

export type SiteSummary = {
  site: PortalSite;
  status: "ok" | "sem-dados" | "sem-acesso";
  /** Últimos 30 dias (inclui hoje), do mais antigo ao mais recente. */
  days: DayRow[];
  today: number;
  yesterday: number;
  last7: number;
  prev7: number;
  last30: number;
  uniquesToday: number;
  apply7: number;
  topSources: Array<[string, number]>;
  /** % de pageviews de hoje vindas do país do mercado; null sem tráfego. */
  homeShare: number | null;
};

type RawDay = {
  pageviews?: number;
  uniques?: number;
  utm?: Record<string, number>;
  countries?: Record<string, number>;
  events?: Record<string, number>;
};

function utcDay(offset = 0) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function empty(site: PortalSite, status: SiteSummary["status"]): SiteSummary {
  return {
    site, status, days: [], today: 0, yesterday: 0, last7: 0, prev7: 0, last30: 0,
    uniquesToday: 0, apply7: 0, topSources: [], homeShare: null,
  };
}

async function loadSite(site: PortalSite): Promise<SiteSummary> {
  let text: string;
  try {
    await stat(site.file);
    text = await readFile(site.file, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return empty(site, code === "EACCES" || code === "EPERM" ? "sem-acesso" : "sem-dados");
  }
  let raw: Record<string, RawDay>;
  try {
    const parsed = JSON.parse(text) as { days?: Record<string, RawDay> };
    if (!parsed || typeof parsed.days !== "object" || !parsed.days) return empty(site, "sem-dados");
    raw = parsed.days;
  } catch {
    return empty(site, "sem-dados");
  }

  const days: DayRow[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = utcDay(-i);
    const d = raw[date];
    days.push({
      date,
      pageviews: num(d?.pageviews),
      uniques: num(d?.uniques),
      applyClicks: num(d?.events?.apply_click),
    });
  }
  const sum = (rows: DayRow[], k: "pageviews" | "applyClicks") =>
    rows.reduce((s, r) => s + r[k], 0);
  const todayRaw = raw[utcDay()];
  const countries = todayRaw?.countries ?? {};
  const totalCountries = Object.values(countries).reduce((s, n) => s + num(n), 0);
  const topSources = Object.entries(todayRaw?.utm ?? {})
    .filter(([, n]) => num(n) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // prev7: dias -13..-7 (antes dos últimos 7)
  const prev7 = days.slice(16, 23);
  return {
    site,
    status: "ok",
    days,
    today: days[29].pageviews,
    yesterday: days[28].pageviews,
    last7: sum(days.slice(23), "pageviews"),
    prev7: sum(prev7, "pageviews"),
    last30: sum(days, "pageviews"),
    uniquesToday: days[29].uniques,
    apply7: sum(days.slice(23), "applyClicks"),
    topSources,
    homeShare: totalCountries > 0 ? ((num(countries[site.country]) / totalCountries) * 100) : null,
  };
}

const g = globalThis as unknown as {
  __portalStats?: { at: number; data: SiteSummary[] };
};

export async function getPortalStats(): Promise<SiteSummary[]> {
  const cached = g.__portalStats;
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const data = await Promise.all(
    configuredSites().map((s) => loadSite(s).catch(() => empty(s, "sem-dados"))),
  );
  g.__portalStats = { at: Date.now(), data };
  return data;
}
