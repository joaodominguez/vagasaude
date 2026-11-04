import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import {
  districtFromSlug,
  filterJobsForCategory,
  isKnownDistrict,
  isKnownProfession,
  jobSubProfession,
  professionFromSlug,
  toCategorySlug,
} from "@/lib/categories";
import {
  classifyJob,
  isConcursoListing,
  JOB_TYPE_LABEL,
  type JobType,
} from "@/lib/job-type";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/** /concursos/<profissão> existe com ≥1 edital aberto; /concursos/<profissão>/<estado> com ≥3. */
export const CONCURSOS_MIN_PROFESSION = 1;
export const CONCURSOS_MIN_COMBO = 3;
/** Tope de cartões renderizados por página (HTML leve para o Googlebot). */
export const CONCURSOS_LIST_CAP = 60;

export type ConcursoItem = { job: Job; type: JobType };

const isConcursoProfession = (profession: string) =>
  profession !== "Outros" && isKnownProfession(profession);

export function concursosPath(
  profession?: string | null,
  district?: string | null,
) {
  if (profession && district) {
    return `/concursos/${toCategorySlug(profession)}/${toCategorySlug(district)}`;
  }
  if (profession) return `/concursos/${toCategorySlug(profession)}`;
  return "/concursos";
}

const listCache = new WeakMap<Job[], ConcursoItem[]>();

/** Editais abertos de seleção pública (concurso, processo seletivo, residência), mais recentes primeiro. */
export function listConcursos(jobs: Job[]): ConcursoItem[] {
  const cached = listCache.get(jobs);
  if (cached) return cached;
  const list = jobs
    .filter(isConcursoListing)
    .map((job) => ({ job, type: classifyJob(job) }))
    .sort(
      (a, b) =>
        b.job.publishedAt.localeCompare(a.job.publishedAt) ||
        a.job.title.localeCompare(b.job.title, "pt"),
    );
  listCache.set(jobs, list);
  return list;
}

export function filterConcursos(
  items: ConcursoItem[],
  profession: string | null,
  district: string | null,
) {
  if (!profession && !district) return items;
  const keep = new Set(
    filterJobsForCategory(
      items.map((item) => item.job),
      profession,
      district,
    ),
  );
  return items.filter((item) => keep.has(item.job));
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"),
  );
}

/** Profissões (incl. sub-profissões técnico/auxiliar de enfermagem) com editais. */
export function concursosProfessions(items: ConcursoItem[]) {
  const values: string[] = [];
  for (const { job } of items) {
    if (isConcursoProfession(job.profession)) values.push(job.profession);
    const sub = jobSubProfession(job);
    if (sub) values.push(sub);
  }
  return countBy(values);
}

export function concursosDistricts(items: ConcursoItem[]) {
  return countBy(items.map(({ job }) => job.district).filter(isKnownDistrict));
}

export function professionLower(profession: string) {
  return profession.toLowerCase();
}

export type ConcursoRef = {
  profession: string | null;
  district: string | null;
  path: string;
  count: number;
};

/** Páginas de /concursos que devem existir (hub excluído). */
export function listEligibleConcursos(items: ConcursoItem[]): ConcursoRef[] {
  const refs: ConcursoRef[] = [];
  for (const [profession, count] of concursosProfessions(items)) {
    if (count < CONCURSOS_MIN_PROFESSION) continue;
    refs.push({ profession, district: null, path: concursosPath(profession), count });
    const subset = filterConcursos(items, profession, null);
    for (const [district, n] of concursosDistricts(subset)) {
      if (n < CONCURSOS_MIN_COMBO) continue;
      refs.push({
        profession,
        district,
        path: concursosPath(profession, district),
        count: n,
      });
    }
  }
  return refs;
}

export function resolveConcursoSegments(a?: string, b?: string) {
  const profession = a ? professionFromSlug(a) : null;
  if (a && (!profession || !isConcursoProfession(profession))) return null;
  const district = b ? districtFromSlug(b) : null;
  if (b && !district) return null;
  return { profession, district };
}

/** Formação habitual (orientativa) por profissão; sempre sujeita ao edital. */
const PROFESSION_REQUIREMENT: Record<string, string> = {
  Enfermagem:
    "Para o cargo de enfermeiro, o edital costuma exigir graduação em Enfermagem e registro ativo no Coren; vagas de técnico e auxiliar pedem curso técnico na área e registro no Coren.",
  "Técnico de Enfermagem":
    "Para técnico de enfermagem, o edital costuma exigir ensino médio com curso técnico em Enfermagem e registro ativo no Coren.",
  "Auxiliar de Enfermagem":
    "Para auxiliar de enfermagem, o edital costuma exigir ensino fundamental ou médio, curso de auxiliar de enfermagem e registro ativo no Coren.",
  Medicina:
    "Para os cargos de médico, o edital costuma exigir graduação em Medicina e registro ativo no CRM; vagas de especialista pedem residência ou título na especialidade.",
  Fisioterapia:
    "Para fisioterapeuta, o edital costuma exigir graduação em Fisioterapia e registro ativo no Crefito.",
  Psicologia:
    "Para psicólogo, o edital costuma exigir graduação em Psicologia e registro ativo no CRP.",
  Farmácia:
    "Para farmacêutico, o edital costuma exigir graduação em Farmácia e registro ativo no CRF.",
  Nutrição:
    "Para nutricionista, o edital costuma exigir graduação em Nutrição e registro ativo no CRN.",
};

export function buildConcursosFaq(
  items: ConcursoItem[],
  profession: string | null,
  district: string | null,
  guideHref: string | null,
) {
  const what = profession ? `de ${professionLower(profession)}` : "na área da saúde";
  const where = district ? ` em ${district}` : "";
  const total = items.length;
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `Quantos concursos e processos seletivos ${what} estão abertos${where}?`,
      a: `Neste momento há ${total} ${total === 1 ? "edital aberto" : "editais abertos"} no VagaSaúde. A lista é atualizada várias vezes por dia a partir de fontes públicas, como portais de concursos e páginas oficiais de órgãos de saúde.`,
    },
    {
      q: "Qual a diferença entre concurso público e processo seletivo simplificado?",
      a: "O concurso público dá acesso a cargo efetivo e costuma ter provas de conhecimento e, em alguns casos, de títulos. O processo seletivo simplificado (PSS) ou seleção pública atende contratações temporárias, em geral com análise de currículo ou prova mais enxuta. Os critérios de cada seleção estão sempre no edital.",
    },
    {
      q: "O que é o edital e onde encontro?",
      a: "O edital é o documento oficial que traz o número de vagas, requisitos, remuneração, forma de seleção, taxa de inscrição e cronograma. Em cada ficha indicamos a fonte, onde você acessa o edital completo.",
    },
    {
      q: "Como faço a inscrição?",
      a: "A inscrição é feita no site da banca organizadora ou do órgão responsável, nunca no VagaSaúde. Prazos, taxa de inscrição e documentos exigidos variam por seleção e constam no edital.",
    },
    {
      q: "Quais as fases de um concurso na saúde?",
      a: "Conforme o edital, podem incluir prova objetiva, prova de títulos, prova prática e exames de saúde. As datas e os critérios de cada fase são definidos pela banca organizadora de cada seleção.",
    },
  ];
  if (profession && PROFESSION_REQUIREMENT[profession]) {
    faq.splice(1, 0, {
      q: `Qual formação é exigida nos concursos ${what}?`,
      a: `${PROFESSION_REQUIREMENT[profession]} Os requisitos exatos dependem de cada edital.`,
    });
  }
  faq.push({
    q: "Posso receber avisos de novos editais?",
    a: "Sim. Crie um alerta gratuito com sua profissão e seu estado e enviamos um email quando surgir uma vaga nova, incluindo concursos e processos seletivos.",
  });
  if (guideHref) {
    faq.push({
      q: "Como ler um edital de concurso na saúde?",
      a: "Veja nosso guia com os pontos que mais importam: cargos e vagas, requisitos, taxa, cronograma e documentos. Os detalhes de cada seleção estão sempre no edital.",
    });
  }
  return faq;
}

export function buildConcursosHeading(
  profession: string | null,
  district: string | null,
) {
  if (profession && district) {
    return `Concursos de ${professionLower(profession)} em ${district}`;
  }
  if (profession) return `Concursos de ${professionLower(profession)}`;
  return "Concursos e processos seletivos na saúde";
}

/** O ano calcula-se ao regenerar a página (ISR); não se fixa à mão. */
export function currentYear() {
  return new Date().getFullYear();
}

export function buildConcursosMetadata(
  profession: string | null,
  district: string | null,
  count: number,
): Metadata {
  const year = currentYear();
  const n = count === 1 ? "1 edital aberto" : `${count} editais abertos`;
  const path = concursosPath(profession, district);
  const title =
    profession && district
      ? `Concursos de ${professionLower(profession)} em ${district} ${year}: ${n}`
      : profession
        ? `Concursos de ${professionLower(profession)} ${year}: ${n}`
        : `Concursos e processos seletivos na saúde ${year}: ${n}`;
  const description = truncateMeta(
    profession
      ? `${n} de concursos públicos e processos seletivos de ${professionLower(profession)}${district ? ` em ${district}` : " em todo o Brasil"}, com link para o edital. Atualizados diariamente.`
      : `${n} de concursos públicos, processos seletivos e residências na área da saúde, com link para o edital. Filtre por profissão e estado. Atualizado diariamente.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      siteName: SITE_NAME,
      locale: "pt_BR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildConcursosItemListJsonLd(
  name: string,
  path: string,
  items: ConcursoItem[],
) {
  const shown = items.slice(0, CONCURSOS_LIST_CAP);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: shown.length,
    itemListElement: shown.map(({ job }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/vagas/${job.slug}`),
      name: job.title,
    })),
  };
}

export { JOB_TYPE_LABEL };
