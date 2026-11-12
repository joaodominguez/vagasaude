import { createHash, randomBytes } from "node:crypto";
import { recordHit } from "@/lib/site-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 2048;
const MAX_HITS_PER_VISITOR_DAY = 400;
const MAX_TRACKED_VISITORS = 200_000;

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|libwww|httpclient|monitor|uptime|pingdom|scrapy|phantom|selenium|puppeteer|playwright|chrome-lighthouse|gtmetrix|pagespeed|mediapartners|feedfetcher|whatsapp|telegram|discord|skype|embedly|bingpreview|yandex|baidu|ahrefs|semrush|mj12|dataprovider|petalbot|bytespider|gptbot|claude|perplexity|ccbot|^$/i;

// Stato solo in memoria, mai persistito: sale casuale del giorno + hash visti.
type DayState = { day: string; salt: string; seen: Map<string, number> };
const g = globalThis as unknown as { __statsDay?: DayState };

function dayState(): DayState {
  const day = new Date().toISOString().slice(0, 10);
  if (!g.__statsDay || g.__statsDay.day !== day) {
    g.__statsDay = { day, salt: randomBytes(32).toString("hex"), seen: new Map() };
  }
  return g.__statsDay;
}

function clean(value: unknown, max: number, re?: RegExp): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, max);
  if (!v) return null;
  if (re && !re.test(v)) return null;
  return v;
}

function utm(value: unknown) {
  const v = clean(value, 50);
  if (!v) return null;
  const lower = v.toLowerCase();
  return /^[a-z0-9_.+\- ]+$/.test(lower) ? lower : null;
}

function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

function referrerHost(raw: unknown, ownHost: string) {
  const v = clean(raw, 300);
  if (!v) return null;
  try {
    const host = new URL(v).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    const own = ownHost.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
    return host === own ? null : host.slice(0, 100);
  } catch {
    return null;
  }
}

function done() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BODY) return done();

    const ua = request.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return done();
    const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""} ${request.headers.get("x-moz") ?? ""}`;
    if (/prefetch|prerender/i.test(purpose)) return done();

    const text = await request.text();
    if (text.length > MAX_BODY) return done();
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== "object") return done();

    const path = clean(
      typeof body.p === "string" ? body.p.split(/[?#]/)[0] : null,
      200,
      /^\/\S*$/,
    );
    if (!path || path.startsWith("/admin") || path.startsWith("/api")) return done();

    const kind = body.t === "event" ? "event" : "pageview";
    const event = kind === "event" ? clean(body.e, 30, /^[a-z_]+$/) : null;
    if (kind === "event" && event !== "apply_click") return done();

    // Visitatore approssimato: hash con sale giornaliero solo in memoria.
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";
    const state = dayState();
    const hash = createHash("sha256")
      .update(`${state.salt}|${ip}|${ua}`)
      .digest("hex")
      .slice(0, 32);
    const hits = state.seen.get(hash);
    if (hits === undefined && state.seen.size >= MAX_TRACKED_VISITORS) return done();
    if (hits !== undefined && hits >= MAX_HITS_PER_VISITOR_DAY) return done();
    state.seen.set(hash, (hits ?? 0) + 1);

    const cc = (request.headers.get("cf-ipcountry") ?? "").toUpperCase();
    const country = /^[A-Z]{2}$/.test(cc) ? cc : "XX";
    const host = request.headers.get("host") ?? "";

    recordHit({
      type: kind,
      path,
      referrer: referrerHost(body.r, host),
      utmSource: utm(body.us),
      utmMedium: utm(body.um),
      utmCampaign: utm(body.uc),
      screen: clean(body.w, 12, /^[0-9<+\-]+$/),
      country,
      device: deviceOf(ua),
      unique: hits === undefined,
      event: event ?? undefined,
      slug: clean(body.s, 200, /^[a-zA-Z0-9_\-.]+$/),
      placement: clean(body.pl, 40, /^[a-zA-Z0-9_\-.]+$/),
    });
  } catch {
    // Payload non valido: ignora in silenzio.
  }
  return done();
}
