import { createHmac, timingSafeEqual } from "node:crypto";
import {
  appendFile,
  chmod,
  chown,
  open,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { EmailEventLine, EmailEventType } from "@/lib/email-events";

/**
 * Receptor do webhook da Resend (assinatura Svix) para os 8 sites
 * (4 saúde + 4 educação). Cada evento vai, pelo domínio do remetente (from),
 * para /var/www/<dir>/data/email-events.jsonl do site certo.
 */

const SITE_DIRS: Record<string, string> = {
  "vagasaude.pt": "vagasaude",
  "vagasaude.com.br": "vagasaudebr",
  "vacantessalud.es": "vacantessalud",
  "offertesanita.it": "offertesanita",
  "vagaeducacao.pt": "vagaeducacao",
  "vagaeducacao.com.br": "vagaeducacaobr",
  "vacanteseducacion.es": "vacanteseducacion",
  "offertescuola.it": "offertescuola",
};

const WWW_ROOT = process.env.EMAIL_EVENTS_ROOT ?? "/var/www";
const ROTATE_BYTES = 20 * 1024 * 1024;
const KEEP_ROTATED = 5;
const TOLERANCE_S = 5 * 60;

const TYPES: Record<string, EmailEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
};

export function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export function siteDirFromFrom(from: unknown): string | null {
  if (typeof from !== "string") return null;
  const m = from.match(/@([a-z0-9.-]+)/i);
  if (!m) return null;
  let host = m[1].toLowerCase();
  while (host) {
    if (SITE_DIRS[host]) return SITE_DIRS[host];
    const dot = host.indexOf(".");
    if (dot < 0) break;
    host = host.slice(dot + 1);
  }
  return null;
}

/** Só path + parâmetros utm_*: nunca tokens nem outros parâmetros. */
export function sanitizeLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    const utm = [...url.searchParams.entries()]
      .filter(([k]) => k.startsWith("utm_"))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    return url.pathname + (utm.length ? `?${utm.join("&")}` : "");
  } catch {
    return null;
  }
}

function utmCampaign(link: string | null) {
  if (!link) return null;
  const m = link.match(/[?&]utm_campaign=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function campaignFromSubject(subject: string): string {
  const s = subject.toLowerCase();
  if (/mais vistas|más vistas|più viste/.test(s)) return "resumo_domingo";
  if (/último aviso|ultimo aviso|última chamada|ultimo avviso/.test(s)) return "alerta_ultimo_lembrete";
  if (/^(confirma|conferma)/.test(s)) return "alerta_confirmacao";
  if (/^(alerta|avviso) (ativ|activ|attiv)/.test(s)) return "alerta_ativo";
  if (/^(nova|nueva|nuova|nuevas|novas|nuove|\d+ (nov|nuev|nuov))/.test(s)) return "alerta_diario";
  return "outro";
}

type Payload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    created_at?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
    click?: { link?: string };
  };
};

function tagsOf(tags: NonNullable<Payload["data"]>["tags"]): Record<string, string> {
  if (!tags) return {};
  if (Array.isArray(tags)) return Object.fromEntries(tags.map((t) => [t.name, t.value]));
  return tags;
}

export function toLine(payload: Payload): { line: EmailEventLine; dir: string } | null {
  const type = payload.type ? TYPES[payload.type] : undefined;
  const d = payload.data;
  if (!type || !d?.email_id) return null;
  const dir = siteDirFromFrom(d.from);
  if (!dir) return null;
  const to = (Array.isArray(d.to) ? d.to[0] : d.to) ?? "";
  const link = type === "clicked" ? sanitizeLink(d.click?.link) : null;
  const subject = (d.subject ?? "").slice(0, 200);
  const campaign = tagsOf(d.tags).campaign || utmCampaign(link) || campaignFromSubject(subject);
  return {
    dir,
    line: {
      type,
      created_at: payload.created_at ?? d.created_at ?? new Date().toISOString(),
      email_id: d.email_id,
      to: to.toLowerCase(),
      subject,
      campaign,
      link,
    },
  };
}

// ---------------------------------------------------------------------------
// Escrita

const g = globalThis as unknown as { __emailEventsQueue?: Promise<unknown> };
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = (g.__emailEventsQueue ?? Promise.resolve()).then(fn, fn);
  g.__emailEventsQueue = next.catch(() => undefined);
  return next;
}

async function ownership(dataDir: string) {
  const ref = await stat(path.join(dataDir, "alerts.json")).catch(() => null);
  if (ref) return { mode: ref.mode & 0o777, uid: ref.uid, gid: ref.gid };
  const dir = await stat(dataDir);
  return { mode: 0o600, uid: dir.uid, gid: dir.gid };
}

async function appendLine(dataDir: string, line: EmailEventLine) {
  const file = path.join(dataDir, "email-events.jsonl");
  const own = await ownership(dataDir);
  const st = await stat(file).catch(() => null);
  if (st && st.size > ROTATE_BYTES) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    await rename(file, `${file}.${stamp}`);
    const old = (await readdir(dataDir))
      .filter((n) => n.startsWith("email-events.jsonl."))
      .sort();
    for (const n of old.slice(0, Math.max(0, old.length - KEEP_ROTATED))) {
      await unlink(path.join(dataDir, n)).catch(() => undefined);
    }
  }
  const existed = await stat(file).then(() => true, () => false);
  if (!existed) {
    const fh = await open(file, "a", own.mode);
    await fh.close();
    await chmod(file, own.mode);
    await chown(file, own.uid, own.gid).catch(() => undefined);
  }
  await appendFile(file, `${JSON.stringify(line)}\n`);
}

type RawAlert = {
  email?: string;
  status?: string;
  emailIssue?: { type: string; at: string; detail?: string | null } | null;
};

/** Marca/limpa emailIssue em alerts.json (mesma lógica de alerts_email_issues.py). */
async function updateIssue(dataDir: string, line: EmailEventLine) {
  const file = path.join(dataDir, "alerts.json");
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return;
  }
  const list = (Array.isArray(raw) ? raw : (raw as { alerts?: RawAlert[] }).alerts) as
    | RawAlert[]
    | undefined;
  if (!list) return;
  let changed = false;
  for (const alert of list) {
    if (alert.status === "unsubscribed") continue;
    if ((alert.email ?? "").toLowerCase() !== line.to) continue;
    const issue = alert.emailIssue;
    if (line.type === "bounced" || line.type === "complained") {
      const type = line.type === "bounced" ? "bounce" : "complaint";
      if (!issue || issue.type !== type) {
        alert.emailIssue = {
          type,
          at: line.created_at.slice(0, 19) + "Z",
          detail: line.subject.slice(0, 120),
        };
        changed = true;
      }
    } else if (
      (line.type === "delivered" || line.type === "opened" || line.type === "clicked") &&
      issue &&
      (issue.type === "bounce" || issue.type === "complaint") &&
      line.created_at > issue.at
    ) {
      alert.emailIssue = null;
      changed = true;
    }
  }
  if (!changed) return;
  const own = await ownership(dataDir);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(raw, null, 2), { mode: own.mode });
  await chmod(tmp, own.mode);
  await chown(tmp, own.uid, own.gid).catch(() => undefined);
  await rename(tmp, file);
}

export function recordEmailEvent(payload: Payload): Promise<boolean> {
  const parsed = toLine(payload);
  if (!parsed) return Promise.resolve(false);
  const dataDir = path.join(WWW_ROOT, parsed.dir, "data");
  return serial(async () => {
    await appendLine(dataDir, parsed.line);
    if (["bounced", "complained", "delivered", "opened", "clicked"].includes(parsed.line.type)) {
      await updateIssue(dataDir, parsed.line).catch((e) =>
        console.error("email-events: emailIssue", e),
      );
    }
    return true;
  });
}
