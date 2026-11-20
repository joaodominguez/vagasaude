import type { Job } from "@/lib/jobs";
import { formatBRL } from "@/lib/salary-benchmarks";
import { knownContract, relativePublished } from "@/lib/job-display";
import { isPublicJob } from "@/lib/job-type";
import { parseAnnouncedSalary } from "@/lib/seo";

/**
 * Texto introdutório das landings, gerado só a partir das vagas reais da página (contagens,
 * entidades, setor, contrato, remuneração anunciada, data da vaga mais recente). Cada frase só
 * aparece quando o dado existe; a ordem e a formulação variam de forma determinística por página.
 */

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function countTop(values: Array<string | null | undefined>, limit: number) {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .slice(0, limit);
}

export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/** Remuneração mensal anunciada (só vagas que a indicam): intervalo e mediana. */
export function salarySummary(jobs: Job[]) {
  const mids: number[] = [];
  let low = Infinity;
  let high = 0;
  for (const job of jobs) {
    const parsed = parseAnnouncedSalary(job.salary);
    if (!parsed || parsed.unitText !== "MONTH") continue;
    const min = parsed.minValue ?? parsed.value;
    const max = parsed.maxValue ?? parsed.value;
    if (min == null || max == null || min < 800 || max > 80_000) continue;
    mids.push((min + max) / 2);
    low = Math.min(low, min);
    high = Math.max(high, max);
  }
  if (mids.length < 3) return null;
  mids.sort((a, b) => a - b);
  const median = mids[Math.floor(mids.length / 2)];
  return { count: mids.length, low, high, median };
}

export type IntroInput = {
  /** Texto do objeto das vagas, ex.: "Técnico de Enfermagem". */
  what: string;
  /** Local, ex.: "São Paulo (SP)". */
  where: string;
  jobs: Job[];
  /** Chave estável da página (o caminho), para variar a formulação. */
  seed: string;
  /** Frase extra com dados da página (cidades, profissões…), já escrita. */
  extra?: string | null;
};

export function buildLocalIntro({ what, where, jobs, seed, extra }: IntroInput) {
  const n = jobs.length;
  const v = hash(seed);
  const parts: string[] = [];

  const newest = jobs.reduce<Job | null>(
    (best, job) => (!best || job.publishedAt > best.publishedAt ? job : best),
    null,
  );
  const when = newest ? relativePublished(newest.publishedAt) : null;
  const recent7 = jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && Date.now() - t < 7 * 86_400_000;
  }).length;

  const opening =
    v % 2 === 0
      ? `Há ${plural(n, "vaga", "vagas")} de ${what} em ${where} abertas neste momento no VagaSaúde`
      : `O VagaSaúde reúne ${plural(n, "vaga ativa", "vagas ativas")} de ${what} em ${where}`;
  const recency =
    recent7 > 0 && recent7 < n
      ? `, ${recent7} delas publicadas nos últimos 7 dias${when ? ` (a mais recente ${when})` : ""}.`
      : when
        ? `; a mais recente foi publicada ${when}.`
        : ".";
  parts.push(`${opening}${recency}`);

  const employers = countTop(jobs.map((job) => job.company), 3);
  const employerTotal = new Set(jobs.map((job) => job.company)).size;
  if (employers.length > 0) {
    const list = joinList(employers.map(([name, count]) => `${name} (${count})`));
    parts.push(
      employerTotal > employers.length
        ? `As ofertas vêm de ${employerTotal} entidades; as que mais publicam são ${list}.`
        : `As entidades contratando são ${list}.`,
    );
  }

  const publicCount = jobs.filter((job) => isPublicJob(job)).length;
  const privateCount = n - publicCount;
  if (publicCount > 0 && privateCount > 0) {
    parts.push(
      `${plural(publicCount, "é do setor público", "são do setor público")} e ${plural(privateCount, "é privada ou filantrópica", "são privadas ou filantrópicas")}.`,
    );
  } else if (publicCount === n) {
    parts.push("Todas são do setor público.");
  } else {
    parts.push("Todas são de entidades privadas ou filantrópicas.");
  }

  const contract = countTop(jobs.map((job) => knownContract(job)), 1)[0];
  if (contract && contract[1] >= 2) {
    parts.push(`O regime mais frequente é ${contract[0]} (${plural(contract[1], "vaga", "vagas")}).`);
  }

  const salary = salarySummary(jobs);
  if (salary) {
    parts.push(
      `${plural(salary.count, "vaga indica", "vagas indicam")} a remuneração no anúncio, entre ${formatBRL(salary.low)} e ${formatBRL(salary.high)} por mês (mediana de ${formatBRL(salary.median)}).`,
    );
  }

  if (extra) parts.push(extra);
  return parts.join(" ");
}
