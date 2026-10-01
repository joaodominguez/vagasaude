import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ScraperRun = {
  id: string;
  source: string;
  status: "ok" | "error";
  found: number;
  created: number | null;
  updated: number | null;
  ignored: number | null;
  review: number | null;
  elapsed: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string;
};

type RunsFile = {
  updatedAt: string;
  runs: ScraperRun[];
};

const MAX_RUNS = 200;

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function runsPath() {
  return path.join(dataDir(), "scraper-runs.json");
}

async function readRunsFile(): Promise<RunsFile> {
  try {
    const raw = JSON.parse(await readFile(runsPath(), "utf8")) as RunsFile;
    return {
      updatedAt: raw.updatedAt || new Date(0).toISOString(),
      runs: Array.isArray(raw.runs) ? raw.runs : [],
    };
  } catch {
    return { updatedAt: new Date(0).toISOString(), runs: [] };
  }
}

async function writeRunsFile(file: RunsFile) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(runsPath(), JSON.stringify(file, null, 2), { mode: 0o600 });
}

export async function listScraperRuns(limit = 50) {
  const file = await readRunsFile();
  return file.runs.slice(0, limit);
}

export async function latestRunBySource() {
  const runs = await listScraperRuns(200);
  const map = new Map<string, ScraperRun>();
  for (const run of runs) {
    if (!map.has(run.source)) map.set(run.source, run);
  }
  return map;
}

export async function recordScraperRun(input: {
  source: string;
  status: "ok" | "error";
  found?: number;
  created?: number | null;
  updated?: number | null;
  ignored?: number | null;
  review?: number | null;
  elapsed?: number | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}) {
  const file = await readRunsFile();
  const now = new Date().toISOString();
  const run: ScraperRun = {
    id: crypto.randomUUID(),
    source: input.source.trim(),
    status: input.status,
    found: Number(input.found || 0),
    created: input.created ?? null,
    updated: input.updated ?? null,
    ignored: input.ignored ?? null,
    review: input.review ?? null,
    elapsed: input.elapsed ?? null,
    error: input.error ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt || now,
  };
  file.runs = [run, ...file.runs].slice(0, MAX_RUNS);
  file.updatedAt = now;
  await writeRunsFile(file);
  return run;
}
