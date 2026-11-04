import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { chmod, chown, mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Estatísticas de utilização próprias, sem cookies e sem identificadores.
 * Só guarda contadores agregados por dia UTC; nunca IPs, user agents ou hashes.
 */

export type DayStats = {
  pageviews: number;
  uniques: number;
  paths: Record<string, number>;
  referrers: Record<string, number>;
  utm: Record<string, number>;
  campaigns: Record<string, number>;
  countries: Record<string, number>;
  devices: { mobile: number; tablet: number; desktop: number };
  screens: Record<string, number>;
  events: Record<string, number>;
  applyBySlug: Record<string, number>;
  applyByPlacement: Record<string, number>;
};

type StatsFile = { days: Record<string, DayStats> };

export type HitInput = {
  type: "pageview" | "event";
  path?: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  screen?: string | null;
  country: string;
  device: "mobile" | "tablet" | "desktop";
  unique: boolean;
  event?: string;
  slug?: string | null;
  placement?: string | null;
};

const MAX_DAYS = 400;
const CAPS = { paths: 500, referrers: 200, utm: 100, campaigns: 100, slugs: 500 };
const FLUSH_MS = 30_000;

type Runtime = {
  data: StatsFile | null;
  dirty: boolean;
  flushing: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  exitHooked: boolean;
};

// globalThis: o route handler e as páginas podem ser bundles separados.
const g = globalThis as unknown as { __siteStats?: Runtime };
const rt: Runtime = (g.__siteStats ??= {
  data: null,
  dirty: false,
  flushing: false,
  timer: null,
  exitHooked: false,
});

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function statsFilePath() {
  return path.join(dataDir(), "site-stats.json");
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function emptyDay(): DayStats {
  return {
    pageviews: 0,
    uniques: 0,
    paths: {},
    referrers: {},
    utm: {},
    campaigns: {},
    countries: {},
    devices: { mobile: 0, tablet: 0, desktop: 0 },
    screens: {},
    events: {},
    applyBySlug: {},
    applyByPlacement: {},
  };
}

function load(): StatsFile {
  if (rt.data) return rt.data;
  const file = statsFilePath();
  let data: StatsFile = { days: {} };
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as StatsFile;
      if (parsed && typeof parsed === "object" && parsed.days) data = parsed;
    } catch {
      // Ficheiro corrompido: preservar para análise em vez de o sobrescrever.
      try {
        renameSync(file, `${file}.corrupt-${Date.now()}`);
      } catch {}
    }
  }
  rt.data = data;
  hookExit();
  return data;
}

function bump(map: Record<string, number>, key: string, cap: number) {
  if (key in map) {
    map[key] += 1;
  } else if (Object.keys(map).length < cap) {
    map[key] = 1;
  } else {
    map["(outros)"] = (map["(outros)"] ?? 0) + 1;
  }
}

export function recordHit(input: HitInput) {
  const data = load();
  const day = (data.days[utcDay()] ??= emptyDay());

  if (input.unique) day.uniques += 1;
  bump(day.countries, input.country, 300);

  if (input.type === "pageview") {
    day.pageviews += 1;
    day.devices[input.device] += 1;
    if (input.path) bump(day.paths, input.path, CAPS.paths);
    if (input.referrer) bump(day.referrers, input.referrer, CAPS.referrers);
    if (input.utmSource || input.utmMedium) {
      bump(
        day.utm,
        `${input.utmSource ?? "-"}/${input.utmMedium ?? "-"}`,
        CAPS.utm,
      );
    }
    if (input.utmCampaign) bump(day.campaigns, input.utmCampaign, CAPS.campaigns);
    if (input.screen) bump(day.screens, input.screen, 10);
  } else if (input.event) {
    bump(day.events, input.event, 20);
    if (input.event === "apply_click") {
      if (input.slug) bump(day.applyBySlug, input.slug, CAPS.slugs);
      if (input.placement) bump(day.applyByPlacement, input.placement, 30);
    }
  }

  rt.dirty = true;
  scheduleFlush();
}

function prune(data: StatsFile) {
  const keys = Object.keys(data.days).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) {
    delete data.days[key];
  }
}

function scheduleFlush() {
  if (rt.timer) return;
  rt.timer = setTimeout(() => {
    rt.timer = null;
    void flushStats();
  }, FLUSH_MS);
  rt.timer.unref?.();
}

/** Escrita atómica (temporário + rename), como o job-store; uma de cada vez. */
export async function flushStats() {
  if (rt.flushing || !rt.dirty || !rt.data) return;
  rt.flushing = true;
  try {
    prune(rt.data);
    rt.dirty = false;
    const filePath = statsFilePath();
    await mkdir(dataDir(), { recursive: true });
    const before = await stat(filePath).catch(() => null);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, JSON.stringify(rt.data), { mode: 0o600 });
    if (before) {
      await chmod(tmpPath, before.mode & 0o777);
      await chown(tmpPath, before.uid, before.gid).catch(() => undefined);
    }
    await rename(tmpPath, filePath);
  } catch (error) {
    rt.dirty = true;
    console.error("site-stats: falha a gravar", error);
  } finally {
    rt.flushing = false;
    if (rt.dirty) scheduleFlush();
  }
}

function flushSync() {
  if (!rt.dirty || !rt.data || rt.flushing) return;
  try {
    prune(rt.data);
    mkdirSync(dataDir(), { recursive: true });
    const filePath = statsFilePath();
    const tmpPath = `${filePath}.tmp-${process.pid}-exit`;
    writeFileSync(tmpPath, JSON.stringify(rt.data), { mode: 0o600 });
    renameSync(tmpPath, filePath);
    rt.dirty = false;
  } catch {}
}

function hookExit() {
  if (rt.exitHooked) return;
  rt.exitHooked = true;
  process.on("exit", flushSync);
  process.on("beforeExit", flushSync);
}

/** Dias mais recentes (do mais antigo para o mais recente), com dias vazios preenchidos. */
export function getRecentDays(count: number) {
  const data = load();
  const out: Array<{ date: string; stats: DayStats }> = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const date = utcDay(new Date(now - i * 86_400_000));
    out.push({ date, stats: data.days[date] ?? emptyDay() });
  }
  return out;
}
