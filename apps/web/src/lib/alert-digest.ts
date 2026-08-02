import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listAlerts } from "@/lib/alerts";
import { newJobsDigestHtml, sendEmail } from "@/lib/email";
import { listJobCards, type JobCardData } from "@/lib/job-store";

type AlertState = {
  lastDigestAt: string | null;
  deliveries: Record<string, string[]>;
};

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

export async function sendNewJobsDigest(limit = 12) {
  const [alerts, jobs, state] = await Promise.all([
    listAlerts(),
    listJobCards(),
    readState(),
  ]);

  if (alerts.length === 0) {
    return { ok: true, subscribers: 0, jobs: 0, sent: 0, failed: 0 };
  }

  const since = state.lastDigestAt
    ? Date.parse(state.lastDigestAt)
    : Date.now() - 24 * 60 * 60 * 1000;

  const freshJobs = jobs
    .filter((job) => {
      const published = Date.parse(job.publishedAt);
      return !Number.isNaN(published) && published >= since;
    })
    .slice(0, limit);

  if (freshJobs.length === 0) {
    state.lastDigestAt = new Date().toISOString();
    await writeState(state);
    return { ok: true, subscribers: alerts.length, jobs: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const alert of alerts) {
    const already = new Set(state.deliveries[alert.email] || []);
    const pending = freshJobs.filter((job) => !already.has(jobKey(job)));
    if (pending.length === 0) continue;

    const result = await sendEmail({
      to: alert.email,
      subject:
        pending.length === 1
          ? `Nova vaga: ${pending[0].title}`
          : `${pending.length} novas vagas de saúde no VagaSaúde`,
      html: newJobsDigestHtml(
        pending.map((job) => ({
          title: job.title,
          company: job.company,
          city: job.city,
          slug: job.slug,
        })),
      ),
    });

    if (result.ok) {
      sent += 1;
      const next = [...already, ...pending.map(jobKey)];
      state.deliveries[alert.email] = next.slice(-200);
    } else {
      failed += 1;
    }
  }

  state.lastDigestAt = new Date().toISOString();
  await writeState(state);

  return {
    ok: failed === 0,
    subscribers: alerts.length,
    jobs: freshJobs.length,
    sent,
    failed,
  };
}
