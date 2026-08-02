import { readFile } from "node:fs/promises";
import path from "node:path";

export type StoredAlert = {
  email: string;
  createdAt: string;
};

export async function listAlerts(): Promise<StoredAlert[]> {
  const directory = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  try {
    const alerts = JSON.parse(
      await readFile(path.join(directory, "alerts.json"), "utf8"),
    ) as StoredAlert[];
    return alerts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
