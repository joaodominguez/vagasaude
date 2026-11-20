/**
 * Calendario dei concorsi (/concorsi/calendario): scadenze dei bandi aperti e, solo quando
 * il testo del bando le indica in modo esplicito, le date di prova. Niente date dedotte.
 */
import type { ConcorsoItem } from "@/lib/concorsi";
import { displayTitle } from "@/lib/display-title";
import { JOB_TYPE_LABEL } from "@/lib/job-type";

export type CalendarEntry = {
  id: string;
  slug: string;
  title: string;
  company: string;
  district: string;
  profession: string;
  typeLabel: string;
  /** Giorno AAAA-MM-GG (fuso Europe/Rome). */
  day: string;
  kind: "scadenza" | "prova";
  /** «Scadenza domande» oppure «Prova scritta». */
  label: string;
};

/** Scadenze oltre questo orizzonte sono quasi sempre errori della fonte (es. anno 2040): fuori dal calendario. */
export const CALENDAR_HORIZON_DAYS = 548;

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export const monthName = (monthIndex0: number) => MONTHS[monthIndex0];
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export function romeDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]}`;
}

const MONTH_RE = MONTHS.join("|");
const PROVA_RE = new RegExp(
  String.raw`(prova\s+(?:preselettiva|scritta|pratica|orale)|preselezione)\s*(?:\([^)]{0,40}\))?\s*[:\-–]?\s*(?:(?:luned|marted|mercoled|gioved|venerd|sabato|domenica)\S*\s+)?(?:il\s+(?:giorno\s+)?)?(\d{1,2})(?:\s*[°º])?\s*(?:(${MONTH_RE})\s+(20\d\d)|[/.](\d{1,2})[/.](20\d\d))`,
  "gi",
);

/** Date di prova scritte per esteso nel testo del bando («Prova scritta: 16 dicembre 2026»). */
export function extractExamDates(text: string): Array<{ day: string; label: string }> {
  const out: Array<{ day: string; label: string }> = [];
  for (const m of text.matchAll(PROVA_RE)) {
    const d = Number(m[2]);
    const month = m[3] ? MONTHS.indexOf(m[3].toLowerCase()) + 1 : Number(m[5]);
    const year = Number(m[4] ?? m[6]);
    if (!d || d > 31 || month < 1 || month > 12) continue;
    const day = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const kind = m[1].toLowerCase().replace(/\s+/g, " ");
    const label = kind === "preselezione" ? "Preselezione" : `Prova ${kind.split(" ")[1]}`;
    if (!out.some((x) => x.day === day && x.label === label)) out.push({ day, label });
  }
  return out;
}

export function buildCalendar(items: ConcorsoItem[], now = Date.now()) {
  const today = romeDay(now);
  const limit = romeDay(now + CALENDAR_HORIZON_DAYS * 86_400_000);
  const entries: CalendarEntry[] = [];
  let withoutDeadline = 0;
  for (const { job, type } of items) {
    const title = displayTitle(job.title, job);
    const base = {
      slug: job.slug,
      title,
      company: job.company,
      district: job.district,
      profession: job.profession,
      typeLabel: JOB_TYPE_LABEL[type],
    };
    const ts = job.expiresAt ? Date.parse(job.expiresAt) : NaN;
    if (Number.isNaN(ts)) {
      withoutDeadline++;
    } else {
      const day = romeDay(ts);
      if (day >= today && day <= limit) {
        entries.push({ ...base, id: `${job.slug}-s`, day, kind: "scadenza", label: "Scadenza domande" });
      }
    }
    for (const exam of extractExamDates(job.description)) {
      if (exam.day >= today && exam.day <= limit) {
        entries.push({ ...base, id: `${job.slug}-p-${exam.day}-${exam.label}`, day: exam.day, kind: "prova", label: exam.label });
      }
    }
  }
  entries.sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, "it"));
  const months = [...new Set(entries.map((e) => e.day.slice(0, 7)))];
  return { entries, months, withoutDeadline, today };
}
