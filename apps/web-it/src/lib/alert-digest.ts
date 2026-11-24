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
import { effectiveSince, weeklySentEmails } from "@/lib/alert-digest-rules";
import { listJobCards, type JobCardData } from "@/lib/job-store";

/** Email di conferma, con il numero di offerte attive oggi per il filtro. */
export async function buildAlertConfirmEmail(alert: StoredAlert) {
  const jobs = await listJobCards();
  const matching = jobs.filter((job) => alertMatchesJob(alert, job)).length;
  return alertConfirmEmail(alert, matching);
}

/** Email di avviso attivo, già con le offerte più recenti del filtro. */
export async function buildAlertConfirmedEmail(alert: StoredAlert) {
  const jobs = await listJobCards();
  const matching = jobs.filter((job) => alertMatchesJob(alert, job));
  return alertConfirmedEmail(alert, matching, jobs);
}

type AlertState = {
  lastDigestAt: string | null;
  /** Giorno locale (AAAA-MM-GG) dell'ultimo riepilogo del mattino: al massimo 1 per mattina. */
  lastDigestDay?: string | null;
  /** Giorno locale dell'ultimo riepilogo serale: al massimo 1 per sera. */
  lastEveningDigestDay?: string | null;
  deliveries: Record<string, string[]>;
  /**
   * Endereços que saltaram o resumo do fim do dia (já receberam o de domingo): data desde a qual as
   * vagas entram no resumo da manhã seguinte. Limpa-se quando esse resumo é enviado (ou não há vagas).
   */
  carryOver?: Record<string, string>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Le offerte più vecchie di così nella fonte non entrano (es. fonte nuova con storico). */
const MAX_SOURCE_AGE_DAYS = 14;
/** Dopo una lunga pausa, non andare indietro oltre questo limite. */
const MAX_LOOKBACK_DAYS = 3;
/** Resend accetta 2 richieste al secondo di default. */
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
 * Il riepilogo viene richiamato al termine di ogni esecuzione degli scraper (ogni 6 h), ma
 * invia solo in due fasce (ora locale): al mattino, alla prima esecuzione tra
 * DIGEST_START_HOUR e DIGEST_END_HOUR (6–14), e a fine giornata, alla prima tra
 * DIGEST_EVENING_START_HOUR e DIGEST_EVENING_END_HOUR (17–23). Ogni riepilogo contiene solo
 * le offerte entrate dal precedente e ogni iscritto lo riceve solo se ci sono nuove offerte
 * per il suo avviso: quindi al massimo 2 email al giorno.
 */
function digestClock(now: Date) {
  const timeZone = process.env.DIGEST_TIMEZONE?.trim() || "Europe/Rome";
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
    timeZone,
    day: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")),
    startHour: Number.isFinite(startHour) ? startHour : 6,
    endHour: Number.isFinite(endHour) ? endHour : 14,
    eveningStartHour: Number.isFinite(eveningStartHour) ? eveningStartHour : 17,
    eveningEndHour: Number.isFinite(eveningEndHour) ? eveningEndHour : 23,
  };
}

/**
 * Ficheiro ÚNICO dos 4 sites de saúde (escrito por scrapers/tools/weekly_digest.py, chaves pt|br|es|it);
 * todas as apps o leem deste caminho, não do seu DATA_DIR. Inexistente/inválido = {} (ninguém saltado).
 */
const WEEKLY_DIGEST_MARKET = "it";
const WEEKLY_DIGEST_STATE_PATH =
  process.env.WEEKLY_DIGEST_STATE_PATH?.trim() || "/var/www/vagasaude/data/weekly-digest-state.json";

async function readWeeklyDigestState(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(WEEKLY_DIGEST_STATE_PATH, "utf8"));
  } catch {
    return {};
  }
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
    return { ok: true, ...base, skipped: "fuori dalle fasce del riepilogo (mattina / sera)" };
  }
  if (morning && state.lastDigestDay === clock.day) {
    return { ok: true, ...base, skipped: "riepilogo del mattino già inviato" };
  }
  if (evening && state.lastEveningDigestDay === clock.day) {
    return { ok: true, ...base, skipped: "riepilogo della sera già inviato" };
  }

  const nowMs = now.getTime();
  const lastDigest = state.lastDigestAt ? Date.parse(state.lastDigestAt) : NaN;
  const since = Math.max(
    Number.isNaN(lastDigest) ? nowMs - DAY_MS : lastDigest,
    nowMs - MAX_LOOKBACK_DAYS * DAY_MS,
  );
  const floor = nowMs - MAX_LOOKBACK_DAYS * DAY_MS;
  const oldestPublished = nowMs - MAX_SOURCE_AGE_DAYS * DAY_MS;
  const carryIn = state.carryOver ?? {};
  const carryOver = { ...carryIn };
  // Fim do dia: quem recebeu hoje o resumo de domingo salta (1 email por dia por endereço).
  const weeklyToday = evening
    ? weeklySentEmails(
        await readWeeklyDigestState(),
        WEEKLY_DIGEST_MARKET,
        alerts,
        clock.day,
        clock.timeZone,
      )
    : new Set<string>();
  // Janela de vagas: a mais antiga entre a normal e os carryOver; cada endereço filtra pela sua.
  const windowStart = Math.min(
    since,
    ...alerts.map((alert) => effectiveSince(since, carryIn, alert.email, floor)),
  );

  // "Nuova" = entrata nel sito dal precedente riepilogo. La data della fonte non basta:
  // molte riportano solo il giorno (00:00) e quelle offerte resterebbero sempre fuori.
  const freshJobs = jobs.filter((job) => {
    const seen = Date.parse(job.firstSeenAt ?? job.publishedAt);
    const published = Date.parse(job.publishedAt);
    return (
      !Number.isNaN(seen) &&
      seen >= windowStart &&
      (Number.isNaN(published) || published >= oldestPublished)
    );
  });

  let sent = 0;
  let failed = 0;
  let skippedWeekly = 0;

  for (const alert of alerts) {
    if (weeklyToday.has(alert.email.toLowerCase())) {
      // Sem enviar e sem marcar como entregues: as vagas entram no resumo da manhã seguinte.
      carryOver[alert.email] = new Date(
        Math.min(since, Date.parse(carryOver[alert.email] ?? "") || since),
      ).toISOString();
      skippedWeekly += 1;
      continue;
    }
    const alertSince = effectiveSince(since, carryIn, alert.email, floor);
    const already = new Set(state.deliveries[alert.email] || []);
    const matching = freshJobs.filter(
      (job) =>
        Date.parse(job.firstSeenAt ?? job.publishedAt) >= alertSince &&
        alertMatchesJob(alert, job) &&
        !already.has(jobKey(job)),
    );
    if (matching.length === 0) {
      if (morning) delete carryOver[alert.email];
      continue;
    }

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
      delete carryOver[alert.email];
    } else {
      failed += 1;
      console.error(`[alert-digest] non riuscito per ${alert.id}: ${result.error}`);
    }
  }

  // Se è fallito tutto (es. Resend non raggiungibile), non avanzare: la prossima esecuzione riprova.
  if (failed === 0 || sent > 0) {
    state.lastDigestAt = now.toISOString();
    if (Object.keys(carryOver).length > 0) state.carryOver = carryOver;
    else delete state.carryOver;
    if (morning) state.lastDigestDay = clock.day;
    else state.lastEveningDigestDay = clock.day;
    await writeState(state);
  }

  return {
    ok: failed === 0,
    ...base,
    slot: morning ? "mattina" : "sera",
    jobs: freshJobs.length,
    sent,
    failed,
    skippedWeekly,
  };
}
