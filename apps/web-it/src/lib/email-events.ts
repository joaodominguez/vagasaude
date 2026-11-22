import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Eventos de email (webhook da Resend, gravado pela app PT em
 * data/email-events.jsonl de cada site). Leitura e agregação para o admin.
 * Formato: ver docs-estrategia/email-events-contrato.md.
 */

export type EmailEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "delivery_delayed";

export type EmailEventLine = {
  type: EmailEventType;
  created_at: string;
  email_id: string;
  to: string;
  subject: string;
  campaign: string;
  link: string | null;
};

const MAX_READ_BYTES = 40 * 1024 * 1024;

function eventsFilePath() {
  return path.join(
    process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
    "email-events.jsonl",
  );
}

type Cache = { at: number; mtime: number; events: EmailEventLine[] };
const g = globalThis as unknown as { __emailEventsCache?: Cache };

/** Todas as linhas válidas do ficheiro atual (cache de 60 s). */
export async function readEmailEvents(): Promise<EmailEventLine[]> {
  const file = eventsFilePath();
  try {
    const st = await stat(file);
    const cached = g.__emailEventsCache;
    if (cached && cached.mtime === st.mtimeMs && Date.now() - cached.at < 60_000) {
      return cached.events;
    }
    if (st.size > MAX_READ_BYTES) return [];
    const raw = await readFile(file, "utf8");
    const events: EmailEventLine[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line) as EmailEventLine;
        if (e && e.type && e.email_id && e.created_at) events.push(e);
      } catch {
        // linha truncada: ignorar
      }
    }
    g.__emailEventsCache = { at: Date.now(), mtime: st.mtimeMs, events };
    return events;
  } catch {
    return [];
  }
}

export type CampaignRow = {
  campaign: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};

/** Contagem por emails distintos (email_id) por campanha, nos últimos `days` dias. */
export function summarizeCampaigns(
  events: EmailEventLine[],
  days: number,
  now = Date.now(),
): CampaignRow[] {
  const since = now - days * 86_400_000;
  const sets = new Map<string, Record<Exclude<keyof CampaignRow, "campaign">, Set<string>>>();
  for (const e of events) {
    if (Date.parse(e.created_at) < since) continue;
    const key = e.campaign || "outro";
    let row = sets.get(key);
    if (!row) {
      row = {
        sent: new Set(),
        delivered: new Set(),
        opened: new Set(),
        clicked: new Set(),
        bounced: new Set(),
        complained: new Set(),
      };
      sets.set(key, row);
    }
    if (e.type === "delivery_delayed") continue;
    row[e.type].add(e.email_id);
  }
  return [...sets.entries()]
    .map(([campaign, r]) => ({
      campaign,
      sent: r.sent.size,
      delivered: r.delivered.size,
      opened: r.opened.size,
      clicked: r.clicked.size,
      bounced: r.bounced.size,
      complained: r.complained.size,
    }))
    .sort((a, b) => b.sent - a.sent);
}

export type RecipientActivity = {
  email: string;
  lastSentAt: string;
  subject: string;
  campaign: string;
  openedAt: string | null;
  clickedAt: string | null;
  clickedLink: string | null;
};

/** Último email de cada destinatário e se foi aberto / clicado (e onde). */
export function lastByRecipient(events: EmailEventLine[]): Map<string, RecipientActivity> {
  const latestId = new Map<string, { id: string; at: string }>();
  for (const e of events) {
    const to = e.to?.toLowerCase();
    if (!to) continue;
    const cur = latestId.get(to);
    if (!cur || e.created_at > cur.at) latestId.set(to, { id: e.email_id, at: e.created_at });
  }
  const out = new Map<string, RecipientActivity>();
  for (const [to, { id }] of latestId) {
    out.set(to, {
      email: to,
      lastSentAt: "",
      subject: "",
      campaign: "",
      openedAt: null,
      clickedAt: null,
      clickedLink: null,
    });
    void id;
  }
  const byId = new Map<string, string>();
  for (const [to, v] of latestId) byId.set(v.id, to);
  for (const e of events) {
    const to = byId.get(e.email_id);
    if (!to) continue;
    const row = out.get(to)!;
    if (e.type === "sent" || !row.subject) {
      row.subject = e.subject || row.subject;
      row.campaign = e.campaign || row.campaign;
    }
    if (e.type === "sent" && (!row.lastSentAt || e.created_at < row.lastSentAt)) {
      row.lastSentAt = e.created_at;
    }
    if (e.type === "opened" && (!row.openedAt || e.created_at < row.openedAt)) {
      row.openedAt = e.created_at;
    }
    if (e.type === "clicked" && (!row.clickedAt || e.created_at < row.clickedAt)) {
      row.clickedAt = e.created_at;
      row.clickedLink = e.link;
    }
  }
  for (const row of out.values()) {
    if (!row.lastSentAt) row.lastSentAt = latestId.get(row.email)?.at ?? "";
  }
  return out;
}
