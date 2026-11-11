import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  alertMatchesJob,
  listActiveAlerts,
  type StoredAlert,
} from "@/lib/alerts";
import {
  alertConfirmEmail,
  alertConfirmedEmail,
  newJobsDigestEmail,
  sendEmail,
} from "@/lib/email";
import { listJobCards, type JobCardData } from "@/lib/job-store";

/** Email de confirmação, com o nº de vagas activas hoje para o filtro. */
export async function buildAlertConfirmEmail(alert: StoredAlert) {
  const jobs = await listJobCards();
  const matching = jobs.filter((job) => alertMatchesJob(alert, job)).length;
  return alertConfirmEmail(alert, matching);
}

/** Email de alerta activo, já com as vagas mais recentes do filtro. */
export async function buildAlertConfirmedEmail(alert: StoredAlert) {
  const jobs = await listJobCards();
  const matching = jobs.filter((job) => alertMatchesJob(alert, job));
  return alertConfirmedEmail(alert, matching, jobs);
}

type AlertState = {
  lastDigestAt: string | null;
  /** Dia local (AAAA-MM-DD) do último resumo da manhã — no máximo 1 por manhã. */
  lastDigestDay?: string | null;
  /** Dia local do último resumo do fim do dia — no máximo 1 por fim do dia. */
  lastEveningDigestDay?: string | null;
  deliveries: Record<string, string[]>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Vagas mais antigas do que isto na fonte não entram (ex.: fonte nova com histórico). */
const MAX_SOURCE_AGE_DAYS = 14;
/** Depois de uma pausa longa, não recuar mais do que isto. */
const MAX_LOOKBACK_DAYS = 3;
/** Resend aceita 2 pedidos/s por defeito. */
const SEND_INTERVAL_MS = 600;

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function statePath() {
  return path.join(dataDir(), "alert-state.json");
}

async function readState(): Promise<AlertState> {
  try {
    return JSON.parse(await readFile(statePath(), "utf8")) as AlertState;
  } catch {
    return { lastDigestAt: null, deliveries: {} };
  }
}

async function writeState(state: AlertState) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(statePath(), JSON.stringify(state, null, 2), { mode: 0o600 });
}

function jobKey(job: JobCardData) {
  return job.slug;
}

/**
 * O digest é chamado no fim de cada execução dos scrapers (de 6 em 6 h), mas só
 * envia em duas janelas (hora local): de manhã, na primeira execução entre
 * DIGEST_START_HOUR e DIGEST_END_HOUR (6–14 h), e ao fim do dia, na primeira entre
 * DIGEST_EVENING_START_HOUR e DIGEST_EVENING_END_HOUR (17–23 h). Cada resumo leva só as
 * vagas que entraram desde o anterior, e cada subscritor só recebe se houver vagas novas
 * para o seu alerta — portanto no máximo 2 emails por dia.
 */
function digestClock(now: Date) {
  const timeZone = process.env.DIGEST_TIMEZONE?.trim() || "Europe/Lisbon";
  const startHour = Number(process.env.DIGEST_START_HOUR ?? 6);
  const endHour = Number(process.env.DIGEST_END_HOUR ?? 14);
  const eveningStartHour = Number(process.env.DIGEST_EVENING_START_HOUR ?? 17);
  const eveningEndHour = Number(process.env.DIGEST_EVENING_END_HOUR ?? 23);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")),
    startHour: Number.isFinite(startHour) ? startHour : 6,
    endHour: Number.isFinite(endHour) ? endHour : 14,
    eveningStartHour: Number.isFinite(eveningStartHour) ? eveningStartHour : 17,
    eveningEndHour: Number.isFinite(eveningEndHour) ? eveningEndHour : 23,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendNewJobsDigest(limit = 10) {
  const now = new Date();
  const clock = digestClock(now);
  const [alerts, jobs, state] = await Promise.all([
    listActiveAlerts(),
    listJobCards(),
    readState(),
  ]);
  const base = { subscribers: alerts.length, jobs: 0, sent: 0, failed: 0 };

  const morning = clock.hour >= clock.startHour && clock.hour < clock.endHour;
  const evening =
    !morning && clock.hour >= clock.eveningStartHour && clock.hour < clock.eveningEndHour;
  if (!morning && !evening) {
    return { ok: true, ...base, skipped: "fora das janelas do resumo (manhã / fim do dia)" };
  }
  if (morning && state.lastDigestDay === clock.day) {
    return { ok: true, ...base, skipped: "resumo da manhã já enviado" };
  }
  if (evening && state.lastEveningDigestDay === clock.day) {
    return { ok: true, ...base, skipped: "resumo do fim do dia já enviado" };
  }

  const nowMs = now.getTime();
  const lastDigest = state.lastDigestAt ? Date.parse(state.lastDigestAt) : NaN;
  const since = Math.max(
    Number.isNaN(lastDigest) ? nowMs - DAY_MS : lastDigest,
    nowMs - MAX_LOOKBACK_DAYS * DAY_MS,
  );
  const oldestPublished = nowMs - MAX_SOURCE_AGE_DAYS * DAY_MS;

  // "Nova" = entrou no site desde o último resumo. A data da fonte não serve:
  // muitas só trazem o dia (00:00), e essas vagas ficavam sempre de fora.
  const freshJobs = jobs.filter((job) => {
    const seen = Date.parse(job.firstSeenAt ?? job.publishedAt);
    const published = Date.parse(job.publishedAt);
    return (
      !Number.isNaN(seen) &&
      seen >= since &&
      (Number.isNaN(published) || published >= oldestPublished)
    );
  });

  let sent = 0;
  let failed = 0;

  for (const alert of alerts) {
    const already = new Set(state.deliveries[alert.email] || []);
    const matching = freshJobs.filter(
      (job) => alertMatchesJob(alert, job) && !already.has(jobKey(job)),
    );
    if (matching.length === 0) continue;

    const email = newJobsDigestEmail(
      alert,
      matching.slice(0, limit),
      matching.length,
      jobs,
    );
    let result = await sendEmail({ to: alert.email, ...email });
    if (!result.ok && result.status === 429) {
      await sleep(2000);
      result = await sendEmail({ to: alert.email, ...email });
    }
    await sleep(SEND_INTERVAL_MS);

    if (result.ok) {
      sent += 1;
      const next = [...already, ...matching.map(jobKey)];
      state.deliveries[alert.email] = next.slice(-300);
    } else {
      failed += 1;
      console.error(`[alert-digest] falhou para ${alert.id}: ${result.error}`);
    }
  }

  // Se falhou tudo (ex.: Resend em baixo), não avançar: a próxima execução tenta de novo.
  if (failed === 0 || sent > 0) {
    state.lastDigestAt = now.toISOString();
    if (morning) state.lastDigestDay = clock.day;
    else state.lastEveningDigestDay = clock.day;
    await writeState(state);
  }

  return {
    ok: failed === 0,
    ...base,
    slot: morning ? "manhã" : "fim do dia",
    jobs: freshJobs.length,
    sent,
    failed,
  };
}
