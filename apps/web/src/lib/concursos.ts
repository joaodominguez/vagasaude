import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import {
  districtFromSlug,
  isKnownDistrict,
  isKnownProfession,
  professionFromSlug,
  toCategorySlug,
} from "@/lib/categories";
import {
  classifyJob,
  isConcursoJob,
  JOB_TYPE_LABEL,
  type JobType,
} from "@/lib/job-type";
import { emLocal } from "@/lib/pt-locative";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/** /concursos/<profissão> existe com ≥1 procedimento aberto; /concursos/<profissão>/<distrito> com ≥3. */
export const CONCURSOS_MIN_PROFESSION = 1;
export const CONCURSOS_MIN_COMBO = 3;
/** Tope de cartões renderizados por página (HTML leve para o Googlebot). */
export const CONCURSOS_LIST_CAP = 60;

const isConcursoProfession = (profession: string) =>
  profession !== "Outros" && isKnownProfession(profession);

export type ConcursoItem = { job: Job; type: JobType };

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

/** Procedimentos abertos de emprego público (concurso, bolsa, mobilidade, manifestação), recentes primeiro. */
export function listConcursos(jobs: Job[]): ConcursoItem[] {
  const cached = listCache.get(jobs);
  if (cached) return cached;
  const list = jobs
    .filter(isConcursoJob)
    .map((job) => ({ job, type: classifyJob(job) }))
    .sort(
      (a, b) =>
        b.job.publishedAt.localeCompare(a.job.publishedAt) ||
        a.job.title.localeCompare(b.job.title, "pt"),
    );
  listCache.set(jobs, list);
  return list;
}

/** Existe /concursos/<profissão> para esta profissão? (≥1 procedimento aberto). */
export function hasConcursoLanding(items: ConcursoItem[], profession: string) {
  return (
    isConcursoProfession(profession) &&
    items.some(({ job }) => job.profession === profession)
  );
}

export function filterConcursos(
  items: ConcursoItem[],
  profession: string | null,
  district: string | null,
) {
  return items.filter(
    ({ job }) =>
      (!profession || job.profession === profession) &&
      (!district || job.district === district),
  );
}

export function countBy<T>(values: T[]) {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt"),
  );
}

export function concursosProfessions(items: ConcursoItem[]) {
  return countBy(items.map(({ job }) => job.profession).filter(isConcursoProfession));
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

/** Páginas de /concursos que devem existir (hub excluído): profissão com ≥1 e combo com ≥3. */
export function listEligibleConcursos(items: ConcursoItem[]): ConcursoRef[] {
  const refs: ConcursoRef[] = [];
  for (const [profession, count] of concursosProfessions(items)) {
    if (count < CONCURSOS_MIN_PROFESSION) continue;
    refs.push({ profession, district: null, path: concursosPath(profession), count });
    const subset = filterConcursos(items, profession, null);
    for (const [district, n] of concursosDistricts(subset)) {
      if (n < CONCURSOS_MIN_COMBO) continue;
      refs.push({ profession, district, path: concursosPath(profession, district), count: n });
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

/** Habilitações habituais (orientativas) para o bloco FAQ de cada profissão. */
const PROFESSION_REQUIREMENT: Record<string, string> = {
  Enfermagem:
    "Para a carreira de enfermagem exige-se, em regra, licenciatura em Enfermagem e inscrição na Ordem dos Enfermeiros; as categorias de enfermeiro especialista e de enfermeiro gestor têm requisitos adicionais.",
  Medicina:
    "Para a carreira médica exige-se mestrado integrado ou licenciatura em Medicina e inscrição na Ordem dos Médicos; as categorias de assistente e de assistente graduado exigem o grau de especialista na área.",
  Farmácia:
    "Para a carreira farmacêutica exige-se o grau académico em Ciências Farmacêuticas e inscrição na Ordem dos Farmacêuticos.",
  Fisioterapia:
    "A fisioterapia integra a carreira de técnico superior de diagnóstico e terapêutica, que exige a licenciatura na respetiva área.",
  "Técnico de Saúde":
    "As carreiras de técnico superior de diagnóstico e terapêutica e de técnico superior de saúde exigem licenciatura na área profissional respetiva.",
};

export function buildConcursosFaq(
  items: ConcursoItem[],
  profession: string | null,
  district: string | null,
  extra?: { guideHref?: string | null; newsHref?: string | null },
) {
  const what = profession ? `de ${professionLower(profession)}` : "na saúde";
  const where = district ? ` ${emLocal(district)}` : "";
  const total = items.length;
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `Quantos concursos ${what} estão abertos${where}?`,
      a: `Neste momento há ${total} ${total === 1 ? "procedimento aberto" : "procedimentos abertos"} no VagaSaúde. A lista é atualizada várias vezes por dia a partir da Bolsa de Emprego Público (BEP), do Diário da República (2.ª série) e dos sites de recrutamento de unidades de saúde públicas.`,
    },
    {
      q: "O que é um procedimento concursal comum?",
      a: "É o procedimento com que os serviços e entidades públicas recrutam trabalhadores. O aviso de abertura é publicado em Diário da República, 2.ª série, e a oferta é divulgada na BEP. No aviso constam os requisitos, os métodos de seleção, o local de trabalho e o prazo de candidatura.",
    },
    {
      q: "Qual a diferença entre concurso, bolsa de recrutamento, mobilidade e manifestação de interesse?",
      a: "O procedimento concursal destina-se a ocupar postos de trabalho concretos. A bolsa (ou reserva) de recrutamento constitui uma lista de candidatos que podem ser chamados para necessidades futuras. A mobilidade permite a trabalhadores que já têm vínculo público mudar de serviço, carreira ou categoria. A manifestação de interesse é usada, por exemplo, para cargos de direção de serviço ou de vogais, e cada entidade define as suas regras.",
    },
    {
      q: "Onde são publicados os concursos?",
      a: "Na BEP (bep.gov.pt), no Diário da República e nos sites das próprias entidades, como as Unidades Locais de Saúde. Em cada ficha indicamos a fonte, onde estão o aviso completo, os requisitos e o prazo.",
    },
    {
      q: "Como me candidato a um concurso?",
      a: "Abre a ficha, consulta o aviso e segue o link para a candidatura: esta faz-se sempre junto da entidade que abre o procedimento, não no VagaSaúde. O prazo para entregar candidaturas é o indicado no aviso de cada procedimento, por isso confirma-o antes de avançares.",
    },
  ];
  if (profession && PROFESSION_REQUIREMENT[profession]) {
    faq.splice(1, 0, {
      q: `Que habilitações são precisas para concursos ${what}?`,
      a: `${PROFESSION_REQUIREMENT[profession]} Os requisitos exatos constam sempre do aviso de cada procedimento.`,
    });
  }
  if (extra?.guideHref) {
    faq.push({
      q: "Como se lê um aviso de abertura de concurso?",
      a: "Preparámos um guia com os pontos a verificar num aviso: requisitos, métodos de seleção, prazo e forma de candidatura.",
    });
  }
  faq.push({
    q: "Posso receber avisos de novos concursos?",
    a: "Sim. Cria um alerta gratuito com a tua profissão e distrito e enviamos-te um email quando surgir uma nova oferta, incluindo concursos e bolsas de recrutamento.",
  });
  return faq;
}

export function buildConcursosHeading(
  profession: string | null,
  district: string | null,
) {
  if (profession && district) {
    return `Concursos de ${professionLower(profession)} ${emLocal(district)}`;
  }
  if (profession) return `Concursos de ${professionLower(profession)}`;
  return "Concursos e bolsas de recrutamento na saúde";
}

/** O ano calcula-se ao regenerar a página (ISR), não se fixa à mão. */
export function currentYear() {
  return new Date().getFullYear();
}

export function buildConcursosMetadata(
  profession: string | null,
  district: string | null,
  count: number,
): Metadata {
  const year = currentYear();
  const n = count === 1 ? "1 procedimento aberto" : `${count} procedimentos abertos`;
  const path = concursosPath(profession, district);
  const title =
    profession && district
      ? `Concursos de ${professionLower(profession)} ${emLocal(district)} ${year}: ${n}`
      : profession
        ? `Concursos de ${professionLower(profession)} ${year}: ${n}`
        : `Concursos na saúde ${year}: ${n}`;
  const description = truncateMeta(
    profession
      ? `${n}: concursos, procedimentos concursais e bolsas de recrutamento de ${professionLower(profession)}${district ? ` ${emLocal(district)}` : " em Portugal"}, com ligação ao aviso oficial. Atualizado diariamente a partir da BEP e do Diário da República.`
      : `${n}: concursos, procedimentos concursais e bolsas de recrutamento do setor público da saúde, com ligação ao aviso oficial. Filtra por profissão e distrito. Atualizado diariamente.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "pt_PT" },
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
