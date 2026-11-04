import type { Metadata } from "next";
import type { Job } from "@/lib/jobs";
import { toCategorySlug, isKnownProfession, isKnownDistrict, districtFromSlug, professionFromSlug } from "@/lib/categories";
import { classifyJob, isOposicionJob, JOB_TYPE_LABEL, type JobType } from "@/lib/job-type";
import { enLugar } from "@/lib/es-locative";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";

/** Una sub-landing de profesión existe con ≥1 convocatoria abierta; la de profesión × comunidad, con ≥3. */
export const OPOSICIONES_MIN_PROFESSION = 1;
export const OPOSICIONES_MIN_COMBO = 3;
/** Tope de tarjetas renderizadas por página (HTML ligero para Googlebot). */
export const OPOSICIONES_LIST_CAP = 60;

const isOposProfession = (profession: string) =>
  profession !== "Otros" && isKnownProfession(profession);

export type OposicionItem = { job: Job; type: JobType };

export function oposicionesPath(
  profession?: string | null,
  district?: string | null,
) {
  if (profession && district) {
    return `/oposiciones/${toCategorySlug(profession)}/${toCategorySlug(district)}`;
  }
  if (profession) return `/oposiciones/${toCategorySlug(profession)}`;
  return "/oposiciones";
}

/** Convocatorias abiertas de empleo público (oposición, bolsa, concurso de traslados), recientes primero. */
export function listOposiciones(jobs: Job[]): OposicionItem[] {
  const cached = listCache.get(jobs);
  if (cached) return cached;
  const list = buildOposiciones(jobs);
  listCache.set(jobs, list);
  return list;
}

const listCache = new WeakMap<Job[], OposicionItem[]>();

/** ¿Existe /oposiciones/<profesión> para esta profesión? (≥1 convocatoria abierta). */
export function hasOposicionLanding(items: OposicionItem[], profession: string) {
  return (
    isOposProfession(profession) &&
    items.some(({ job }) => job.profession === profession)
  );
}

function buildOposiciones(jobs: Job[]): OposicionItem[] {
  return jobs
    .filter(isOposicionJob)
    .map((job) => ({ job, type: classifyJob(job) }))
    .sort(
      (a, b) =>
        b.job.publishedAt.localeCompare(a.job.publishedAt) ||
        a.job.title.localeCompare(b.job.title, "es"),
    );
}

export function filterOposiciones(
  items: OposicionItem[],
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
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "es"),
  );
}

export function oposicionesProfessions(items: OposicionItem[]) {
  return countBy(items.map(({ job }) => job.profession).filter(isOposProfession));
}

export function oposicionesDistricts(items: OposicionItem[]) {
  return countBy(items.map(({ job }) => job.district).filter(isKnownDistrict));
}

export function professionLower(profession: string) {
  return profession === "TCAE" ? "TCAE" : profession.toLowerCase();
}

export type OposicionRef = {
  profession: string | null;
  district: string | null;
  path: string;
  count: number;
};

/** Páginas de /oposiciones que deben existir (hub excluido): profesión con ≥1 y combo con ≥3. */
export function listEligibleOposiciones(items: OposicionItem[]): OposicionRef[] {
  const refs: OposicionRef[] = [];
  for (const [profession, count] of oposicionesProfessions(items)) {
    if (count < OPOSICIONES_MIN_PROFESSION) continue;
    refs.push({ profession, district: null, path: oposicionesPath(profession), count });
    const subset = filterOposiciones(items, profession, null);
    for (const [district, n] of oposicionesDistricts(subset)) {
      if (n < OPOSICIONES_MIN_COMBO) continue;
      refs.push({ profession, district, path: oposicionesPath(profession, district), count: n });
    }
  }
  return refs;
}

export function resolveOposicionSegments(a?: string, b?: string) {
  const profession = a ? professionFromSlug(a) : null;
  if (a && (!profession || !isOposProfession(profession))) return null;
  const district = b ? districtFromSlug(b) : null;
  if (b && !district) return null;
  return { profession, district };
}

/** Titulación habitual (orientativa) para el bloque FAQ de cada profesión. */
const PROFESSION_REQUIREMENT: Record<string, string> = {
  Enfermería:
    "Para las plazas de enfermería se exige el título de Grado (o Diplomatura) en Enfermería; las plazas de enfermero/a especialista piden además la especialidad correspondiente.",
  TCAE:
    "Para las plazas de TCAE se exige el título de Técnico/a en Cuidados Auxiliares de Enfermería (FP de grado medio) o equivalente.",
  Medicina:
    "Para las plazas de medicina se exige el título de Licenciatura o Grado en Medicina y, en las plazas de especialista (FEA), el título de la especialidad.",
  Fisioterapia:
    "Para las plazas de fisioterapia se exige el título de Grado (o Diplomatura) en Fisioterapia.",
  Celador:
    "Los requisitos de titulación de las plazas de celador los fija cada convocatoria: revisa siempre las bases.",
};

export function buildOposicionesFaq(
  items: OposicionItem[],
  profession: string | null,
  district: string | null,
) {
  const what = profession ? `de ${professionLower(profession)}` : "sanitarias";
  const where = district ? ` ${enLugar(district)}` : "";
  const total = items.length;
  const faq: Array<{ q: string; a: string }> = [
    {
      q: `¿Cuántas oposiciones y bolsas ${what} hay abiertas${where}?`,
      a: `Ahora mismo hay ${total} ${total === 1 ? "convocatoria abierta" : "convocatorias abiertas"} en VacantesSalud. La lista se actualiza varias veces al día a partir del BOE y de los boletines oficiales de las comunidades autónomas.`,
    },
    {
      q: "¿Qué es una OPE (Oferta de Empleo Público)?",
      a: "Es el instrumento con el que cada Administración aprueba las plazas de empleo público que se van a cubrir. Después, cada servicio de salud o institución convoca los procesos selectivos (oposición o concurso-oposición) para esas plazas y publica sus bases.",
    },
    {
      q: "¿Qué diferencia hay entre oposición, bolsa de empleo y concurso de traslados?",
      a: "La oposición (o concurso-oposición) da acceso a una plaza fija como personal estatutario o funcionario. La bolsa de empleo es una lista de personas candidatas para contrataciones temporales (interinidades, sustituciones, eventuales). El concurso de traslados permite al personal que ya tiene plaza fija cambiar de destino.",
    },
    {
      q: "¿Dónde se publican las convocatorias?",
      a: "En el BOE y en los boletines oficiales de cada comunidad autónoma, además de las webs de los servicios de salud. En cada ficha enlazamos a la fuente oficial: allí están las bases, los requisitos, las tasas y el plazo de solicitud.",
    },
    {
      q: "¿Cómo me presento a una convocatoria?",
      a: "Abre la convocatoria, lee las bases y pulsa «Inscribirme»: la solicitud se hace siempre en la sede o web oficial de la entidad convocante, no en VacantesSalud. El plazo de solicitud lo fija cada convocatoria, así que conviene comprobarlo en las bases.",
    },
  ];
  if (profession && PROFESSION_REQUIREMENT[profession]) {
    faq.splice(1, 0, {
      q: `¿Qué titulación necesito para las oposiciones ${what}?`,
      a: `${PROFESSION_REQUIREMENT[profession]} Los requisitos exactos dependen de cada convocatoria.`,
    });
  }
  faq.push({
    q: "¿Puedo recibir avisos de nuevas convocatorias?",
    a: "Sí. Crea una alerta gratuita con tu profesión y tu comunidad y te escribimos por email cuando aparezca una oferta nueva, incluidas oposiciones y bolsas.",
  });
  return faq;
}

export function buildOposicionesHeading(profession: string | null, district: string | null) {
  if (profession && district) {
    return `Oposiciones de ${professionLower(profession)} ${enLugar(district)}`;
  }
  if (profession) return `Oposiciones de ${professionLower(profession)}`;
  return "Oposiciones y bolsas de empleo de sanidad";
}

/** El año se calcula al regenerar la página (ISR), no se fija a mano. */
export function currentYear() {
  return new Date().getFullYear();
}

export function buildOposicionesMetadata(
  profession: string | null,
  district: string | null,
  count: number,
): Metadata {
  const year = currentYear();
  const n = count === 1 ? "1 convocatoria abierta" : `${count} convocatorias abiertas`;
  const path = oposicionesPath(profession, district);
  const title =
    profession && district
      ? `Oposiciones de ${professionLower(profession)} ${enLugar(district)} ${year}: ${n}`
      : profession
        ? `Oposiciones de ${professionLower(profession)} ${year}: ${n}`
        : `Oposiciones y OPE de sanidad ${year}: ${n}`;
  const description = truncateMeta(
    profession
      ? `${n} de oposiciones, OPE y bolsas de empleo de ${professionLower(profession)}${district ? ` ${enLugar(district)}` : " en toda España"}, con enlace a las bases oficiales. Actualizadas a diario desde el BOE y los boletines autonómicos.`
      : `${n} de oposiciones, OPE y bolsas de empleo del sistema sanitario público, con enlace a las bases oficiales. Filtra por profesión y comunidad autónoma. Actualizado a diario.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: SITE_NAME, locale: "es_ES" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildOposicionesItemListJsonLd(
  name: string,
  path: string,
  items: OposicionItem[],
) {
  const shown = items.slice(0, OPOSICIONES_LIST_CAP);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: shown.length,
    itemListElement: shown.map(({ job }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/empleo/${job.slug}`),
      name: job.title,
    })),
  };
}

export { JOB_TYPE_LABEL };
