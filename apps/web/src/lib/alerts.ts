import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AlertStatus = "pending_confirm" | "active" | "unsubscribed";

export type AlertFilters = {
  district: string | null;
  profession: string | null;
  sector: string | null;
};

export type StoredAlert = {
  id: string;
  email: string;
  token: string;
  status: AlertStatus;
  filters: AlertFilters;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
};

type LegacyAlert = {
  email?: string;
  createdAt?: string;
  token?: string;
  status?: AlertStatus;
  filters?: Partial<AlertFilters>;
  id?: string;
  updatedAt?: string;
  confirmedAt?: string | null;
  unsubscribedAt?: string | null;
};

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function alertsFilePath() {
  return path.join(dataDir(), "alerts.json");
}

export function createAlertToken() {
  return randomBytes(24).toString("hex");
}

function createAlertId(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

function normalizeFilters(input?: Partial<AlertFilters> | null): AlertFilters {
  return {
    district: input?.district?.trim() || null,
    profession: input?.profession?.trim() || null,
    sector: input?.sector?.trim() || null,
  };
}

function normalizeAlert(raw: LegacyAlert): StoredAlert | null {
  const email = raw.email?.trim().toLowerCase();
  if (!email) return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  const status = raw.status || "active";
  return {
    id: raw.id || createAlertId(email),
    email,
    token: raw.token || createAlertToken(),
    status,
    filters: normalizeFilters(raw.filters),
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
    confirmedAt:
      raw.confirmedAt ?? (status === "active" ? createdAt : null),
    unsubscribedAt: raw.unsubscribedAt ?? null,
  };
}

async function readAlertsFile(): Promise<StoredAlert[]> {
  try {
    const file = await readFile(alertsFilePath(), "utf8");
    const raw = JSON.parse(file) as LegacyAlert[] | { alerts?: LegacyAlert[] };
    const list = Array.isArray(raw) ? raw : raw.alerts || [];
    const alerts = list
      .map(normalizeAlert)
      .filter((alert): alert is StoredAlert => Boolean(alert));

    // Persist tokens/status for legacy rows so manage links stay stable.
    const needsPersist = list.some(
      (item) => item.email && (!item.token || !item.status || !item.id),
    );
    if (needsPersist && alerts.length > 0) {
      await writeAlertsFile(alerts);
    }

    return alerts;
  } catch {
    return [];
  }
}

async function writeAlertsFile(alerts: StoredAlert[]) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(alertsFilePath(), JSON.stringify(alerts, null, 2), {
    mode: 0o600,
  });
}

export async function listAlerts(): Promise<StoredAlert[]> {
  const alerts = await readAlertsFile();
  return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listActiveAlerts(): Promise<StoredAlert[]> {
  const alerts = await listAlerts();
  return alerts.filter((alert) => alert.status === "active");
}

export async function getAlertByToken(token: string) {
  if (!token) return null;
  const alerts = await readAlertsFile();
  return alerts.find((alert) => alert.token === token) ?? null;
}

export async function getAlertByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const alerts = await readAlertsFile();
  return alerts.find((alert) => alert.email === normalized) ?? null;
}

export async function upsertAlertSubscription(input: {
  email: string;
  filters?: Partial<AlertFilters> | null;
}) {
  const email = input.email.trim().toLowerCase();
  const alerts = await readAlertsFile();
  const now = new Date().toISOString();
  const existing = alerts.find((alert) => alert.email === email);
  const filters = normalizeFilters(input.filters);

  if (existing) {
    const wasUnsubscribed = existing.status === "unsubscribed";
    existing.filters = filters;
    existing.updatedAt = now;
    if (wasUnsubscribed || existing.status === "pending_confirm") {
      existing.status = "pending_confirm";
      existing.token = createAlertToken();
      existing.confirmedAt = null;
      existing.unsubscribedAt = null;
    }
    await writeAlertsFile(alerts);
    return {
      alert: existing,
      created: false,
      needsConfirmation:
        existing.status === "pending_confirm" || wasUnsubscribed,
    };
  }

  const alert: StoredAlert = {
    id: createAlertId(email),
    email,
    token: createAlertToken(),
    status: "pending_confirm",
    filters,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    unsubscribedAt: null,
  };
  alerts.push(alert);
  await writeAlertsFile(alerts);
  return { alert, created: true, needsConfirmation: true };
}

export async function confirmAlert(token: string) {
  const alerts = await readAlertsFile();
  const alert = alerts.find((item) => item.token === token);
  if (!alert) return null;
  if (alert.status === "unsubscribed") return alert;
  const now = new Date().toISOString();
  alert.status = "active";
  alert.confirmedAt = now;
  alert.updatedAt = now;
  await writeAlertsFile(alerts);
  return alert;
}

export async function updateAlertPreferences(
  token: string,
  filters: Partial<AlertFilters>,
) {
  const alerts = await readAlertsFile();
  const alert = alerts.find((item) => item.token === token);
  if (!alert || alert.status === "unsubscribed") return null;
  alert.filters = normalizeFilters(filters);
  alert.updatedAt = new Date().toISOString();
  if (alert.status === "pending_confirm") {
    // keep pending until they confirm via email link
  }
  await writeAlertsFile(alerts);
  return alert;
}

export async function unsubscribeAlert(token: string) {
  const alerts = await readAlertsFile();
  const alert = alerts.find((item) => item.token === token);
  if (!alert) return null;
  const now = new Date().toISOString();
  alert.status = "unsubscribed";
  alert.unsubscribedAt = now;
  alert.updatedAt = now;
  await writeAlertsFile(alerts);
  return alert;
}

export function alertMatchesJob(
  alert: StoredAlert,
  job: { district: string; profession: string; sector: string },
) {
  const { filters } = alert;
  if (filters.district && filters.district !== job.district) return false;
  if (filters.profession && filters.profession !== job.profession) return false;
  if (filters.sector && filters.sector !== job.sector) return false;
  return true;
}

export function describeAlertFilters(alert: StoredAlert) {
  const parts = [
    alert.filters.profession,
    alert.filters.district,
    alert.filters.sector,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Todas as vagas de saúde";
}
