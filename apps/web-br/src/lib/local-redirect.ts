import { CATEGORY_MIN_JOBS, districtFromSlug, filterJobsForCategory } from "@/lib/categories";
import { cityOfJob } from "@/lib/cities";
import type { Job } from "@/lib/jobs";
import { openJobsDb } from "@/lib/job-slug-exists";
import { LOCAL_MIN_JOBS, localProfessionFromSlug } from "@/lib/local-landings";

/**
 * Redirect das landings profissão × cidade sem volume, feito no proxy (não com redirect() na
 * página: no Next 16 o redirect de páginas ISR devolvia o cabeçalho Location duplicado).
 *
 * O proxy não tem a lista de vagas em memória, por isso conta direto no jobs.db (vagas publicadas do
 * estado, em cache 60 s). A contagem é uma estimativa por excesso (não aplica o prazo/idade das
 * vagas), logo só redireciona quando MESMO ASSIM há menos de LOCAL_MIN_JOBS vagas; se o valor real
 * ficar abaixo do mínimo sem o proxy o ver, a página responde 404. Sem base (JOB_STORE=json) não faz nada.
 */
type Row = { t: string | null; p: string | null; c: string | null };

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; jobs: Job[] }>();

function stateJobs(district: string): Job[] | null {
  const hit = cache.get(district);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.jobs;
  const db = openJobsDb();
  if (!db) return null;
  try {
    const rows = (db
      .prepare(
        `SELECT json_extract(body,'$.title') AS t, json_extract(body,'$.profession') AS p,
                json_extract(body,'$.locationConcelho') AS c
           FROM jobs
          WHERE status = 'published' AND json_extract(body,'$.locationDistrict') = ?`,
      ) as unknown as { all(...p: unknown[]): unknown[] }).all(district) as Row[];
    const jobs = rows.map(
      (row) =>
        ({
          title: row.t ?? "",
          profession: row.p ?? "",
          district,
          city: row.c || district,
        }) as Job,
    );
    cache.set(district, { at: Date.now(), jobs });
    return jobs;
  } finally {
    db.close();
  }
}

/** Destino do redirect para /vagas/<estado>/<cidade>/<profissao>[/pagina-N] sem volume, ou null. */
export function localRedirectTarget(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts[0] !== "vagas" || (parts.length !== 4 && parts.length !== 5)) return null;
  const [, stateSlug, citySlug, professionSlug, tail] = parts;
  if (tail !== undefined && !/^pagina-\d{1,4}$/.test(tail)) return null;
  const district = districtFromSlug(stateSlug);
  const profession = localProfessionFromSlug(professionSlug);
  if (!district || !profession || citySlug.startsWith("pagina-")) return null;
  try {
    const jobs = stateJobs(district);
    if (!jobs) return null;
    const inCity = jobs.filter((job) => cityOfJob(job)?.slug === citySlug);
    if (inCity.length === 0) return null; // cidade desconhecida: 404 da página
    if (filterJobsForCategory(inCity, profession, null).length >= LOCAL_MIN_JOBS) return null;
    return inCity.length >= CATEGORY_MIN_JOBS ? `/vagas/${stateSlug}/${citySlug}` : `/vagas/${stateSlug}`;
  } catch {
    return null;
  }
}
