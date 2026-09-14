import type { Job } from "@/lib/jobs";
import {
  districts as categoryDistricts,
  professions as taxonomyProfessions,
} from "@/lib/taxonomies";
import { absoluteUrl, SITE_NAME, truncateMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const CATEGORY_MIN_JOBS = 3;

const PROFESSION_LABELS = [...taxonomyProfessions, "Outros"] as const;

/** Distritos/regiões válidos para landings (continente + ilhas). */
export const CATEGORY_DISTRICTS = categoryDistricts;

function normalizeKey(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toCategorySlug(label: string) {
  return normalizeKey(label);
}

const PROFESSION_BY_SLUG = new Map(
  PROFESSION_LABELS.map((label) => [toCategorySlug(label), label] as const),
);
const DISTRICT_BY_SLUG = new Map(
  CATEGORY_DISTRICTS.map((label) => [toCategorySlug(label), label] as const),
);

export function professionFromSlug(slug: string) {
  return PROFESSION_BY_SLUG.get(slug) ?? null;
}

export function districtFromSlug(slug: string) {
  return DISTRICT_BY_SLUG.get(slug) ?? null;
}

export function isKnownProfession(label: string) {
  return PROFESSION_BY_SLUG.has(toCategorySlug(label));
}

export function isKnownDistrict(label: string) {
  return DISTRICT_BY_SLUG.has(toCategorySlug(label));
}

export function isReservedCategorySlug(slug: string) {
  return PROFESSION_BY_SLUG.has(slug) || DISTRICT_BY_SLUG.has(slug);
}

export type CategoryKind = "profession" | "district" | "combo";

export type CategoryRef = {
  kind: CategoryKind;
  profession: string | null;
  district: string | null;
  path: string;
  title: string;
};

export function categoryPath(
  profession: string | null | undefined,
  district: string | null | undefined,
) {
  const p = profession ? toCategorySlug(profession) : null;
  const d = district ? toCategorySlug(district) : null;
  if (p && d) return `/vagas/${p}/${d}`;
  if (p) return `/vagas/${p}`;
  if (d) return `/vagas/${d}`;
  return "/vagas";
}

/** Título H1 / SEO da landing (profissão, distrito ou combo). */
export function categoryHeading(
  kind: CategoryKind,
  profession: string | null,
  district: string | null,
) {
  if (kind === "combo" && profession && district) {
    return `Vagas de ${profession} em ${district}`;
  }
  if (kind === "profession" && profession) {
    return `Vagas de ${profession} em Portugal`;
  }
  if (district) {
    return `Emprego na saúde em ${district}`;
  }
  return "Vagas de saúde";
}

export function resolveCategoryFromSegments(
  a: string,
  b?: string,
): CategoryRef | null {
  if (b) {
    const profession = professionFromSlug(a);
    const district = districtFromSlug(b);
    if (!profession || !district) return null;
    return {
      kind: "combo",
      profession,
      district,
      path: categoryPath(profession, district),
      title: categoryHeading("combo", profession, district),
    };
  }

  const profession = professionFromSlug(a);
  if (profession) {
    return {
      kind: "profession",
      profession,
      district: null,
      path: categoryPath(profession, null),
      title: categoryHeading("profession", profession, null),
    };
  }

  const district = districtFromSlug(a);
  if (district) {
    return {
      kind: "district",
      profession: null,
      district,
      path: categoryPath(null, district),
      title: categoryHeading("district", null, district),
    };
  }

  return null;
}

export function filterJobsForCategory(
  jobs: Job[],
  profession: string | null,
  district: string | null,
) {
  return jobs.filter((job) => {
    if (profession && job.profession !== profession) return false;
    if (district && job.district !== district) return false;
    return true;
  });
}

export type CategoryStats = {
  jobs: Job[];
  count: number;
  topCompanies: Array<{ name: string; count: number }>;
  sectorCounts: Array<{ name: string; count: number }>;
  contractCounts: Array<{ name: string; count: number }>;
  districtCounts: Array<{ name: string; count: number }>;
  professionCounts: Array<{ name: string; count: number }>;
};

function topCounts(
  values: string[],
  limit = 5,
): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || "Outros";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.name.localeCompare(b.name, "pt"),
    )
    .slice(0, limit);
}

export function buildCategoryStats(jobs: Job[]): CategoryStats {
  return {
    jobs,
    count: jobs.length,
    topCompanies: topCounts(
      jobs.map((job) => job.company),
      5,
    ),
    sectorCounts: topCounts(
      jobs.map((job) => job.sector),
      3,
    ),
    contractCounts: topCounts(
      jobs.map((job) => job.contract),
      4,
    ),
    districtCounts: topCounts(
      jobs.map((job) => job.district),
      8,
    ),
    professionCounts: topCounts(
      jobs.map((job) => job.profession),
      8,
    ),
  };
}

export function listEligibleCategories(jobs: Job[]): CategoryRef[] {
  const refs: CategoryRef[] = [];

  const professions = new Set(
    jobs.map((job) => job.profession).filter(isKnownProfession),
  );
  for (const profession of professions) {
    const subset = filterJobsForCategory(jobs, profession, null);
    if (subset.length < CATEGORY_MIN_JOBS) continue;
    refs.push({
      kind: "profession",
      profession,
      district: null,
      path: categoryPath(profession, null),
      title: categoryHeading("profession", profession, null),
    });
  }

  const districts = new Set(
    jobs.map((job) => job.district).filter(isKnownDistrict),
  );
  for (const district of districts) {
    const subset = filterJobsForCategory(jobs, null, district);
    if (subset.length < CATEGORY_MIN_JOBS) continue;
    refs.push({
      kind: "district",
      profession: null,
      district,
      path: categoryPath(null, district),
      title: categoryHeading("district", null, district),
    });
  }

  for (const profession of professions) {
    for (const district of districts) {
      const subset = filterJobsForCategory(jobs, profession, district);
      if (subset.length < CATEGORY_MIN_JOBS) continue;
      refs.push({
        kind: "combo",
        profession,
        district,
        path: categoryPath(profession, district),
        title: categoryHeading("combo", profession, district),
      });
    }
  }

  return refs
    .filter((ref) => {
      // Garantir que o path resolve na rota (evita chips 404).
      const segments = ref.path.replace(/^\/vagas\//, "").split("/");
      return Boolean(resolveCategoryFromSegments(segments[0], segments[1]));
    })
    .sort((a, b) => a.path.localeCompare(b.path, "pt"));
}

/** Chips para homepage/listagem: só categorias com página real, por volume. */
export function listCategoryChips(jobs: Job[], limit = 10): CategoryRef[] {
  return listEligibleCategories(jobs)
    .filter((item) => item.kind === "profession" || item.kind === "district")
    .map((item) => ({
      item,
      count: filterJobsForCategory(jobs, item.profession, item.district).length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.item.path.localeCompare(b.item.path, "pt"),
    )
    .slice(0, limit)
    .map(({ item }) => item);
}

export function isCategoryEligible(
  jobs: Job[],
  profession: string | null,
  district: string | null,
) {
  return (
    filterJobsForCategory(jobs, profession, district).length >=
    CATEGORY_MIN_JOBS
  );
}

export function buildCategoryIntro(
  stats: CategoryStats,
  profession: string | null,
  district: string | null,
) {
  const where = district ? `em ${district}` : "em Portugal";
  const companies = stats.topCompanies
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");
  const sectors = stats.sectorCounts
    .map((item) => `${item.count} no setor ${item.name.toLowerCase()}`)
    .join(", ");
  const contracts = stats.contractCounts
    .slice(0, 3)
    .map((item) => item.name.toLowerCase())
    .join(", ");

  const focus =
    profession && district
      ? `Emprego de ${professionSearchPhrase(profession)} em ${district}: oportunidades actualizadas a partir de fontes públicas e privadas.`
      : profession
        ? `Emprego de ${professionSearchPhrase(profession)} em Portugal, com filtros por localização e sector.`
        : `Emprego na saúde ${where}, agregado de hospitais, clínicas, laboratórios e outras entidades.`;

  const employerLine = companies
    ? `Entre as entidades que estão a contratar neste momento destacam-se ${companies}.`
    : `As ofertas vêm de entidades de saúde em todo o país.`;

  const mixLine = sectors
    ? `Neste momento há ${stats.count} ${stats.count === 1 ? "oferta" : "ofertas"} activas: ${sectors}.`
    : `Neste momento há ${stats.count} ${stats.count === 1 ? "oferta activa" : "ofertas activas"}.`;

  const contractLine = contracts
    ? `Os tipos de contrato mais comuns são ${contracts}.`
    : "";

  const cta =
    "Podes candidatar-te directamente no site da entidade ou criar um alerta para receber novas oportunidades por email.";

  const text = [focus, mixLine, employerLine, contractLine, cta]
    .filter(Boolean)
    .join(" ");

  if (text.length <= 150 * 6) return text;
  return truncateMeta(text, 900);
}

export function buildCategoryMetadata(
  ref: CategoryRef,
  count: number,
): Metadata {
  const title = categorySerpTitle(ref, count);
  const description = truncateMeta(
    professionDistrictDescription(ref, count),
    160,
  );

  return {
    title,
    description,
    alternates: { canonical: ref.path },
    openGraph: {
      title,
      description,
      url: ref.path,
      type: "website",
      siteName: SITE_NAME,
      locale: "pt_PT",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** Frase de intenção de pesquisa (SERP) — mais próxima de "emprego …" do Google. */
function professionSearchPhrase(profession: string): string {
  const map: Record<string, string> = {
    Enfermagem: "enfermagem",
    Medicina: "médico",
    Fisioterapia: "fisioterapeuta",
    Auxiliares: "auxiliar de ação médica",
    "Técnico de Saúde": "técnico de saúde",
    Farmácia: "farmacêutico",
    Psicologia: "psicólogo",
    Nutrição: "nutricionista",
    "Assistência Social": "assistente social",
    Formação: "formador de saúde",
    "Comercial / Farma": "delegado de informação médica",
    "Gestão & suporte": "gestão em saúde",
    Administrativo: "administrativo de saúde",
  };
  return map[profession] ?? profession.toLowerCase();
}

function categorySerpTitle(ref: CategoryRef, count: number): string {
  const n = String(count);
  if (ref.kind === "combo" && ref.profession && ref.district) {
    return `Emprego de ${professionSearchPhrase(ref.profession)} em ${ref.district}: ${n} vagas`;
  }
  if (ref.kind === "profession" && ref.profession) {
    return `Emprego de ${professionSearchPhrase(ref.profession)}: ${n} vagas em Portugal`;
  }
  return `Emprego na saúde em ${ref.district}: ${n} vagas`;
}

function professionDistrictDescription(ref: CategoryRef, count: number) {
  const n = count === 1 ? "1 vaga" : `${count} vagas`;
  if (ref.kind === "combo" && ref.profession && ref.district) {
    const phrase = professionSearchPhrase(ref.profession);
    return `Emprego de ${phrase} em ${ref.district} — ${n} actualizadas. Hospitais, clínicas e IPSS no VagaSaúde; candidata-te no site da entidade.`;
  }
  if (ref.kind === "profession" && ref.profession) {
    const phrase = professionSearchPhrase(ref.profession);
    const extra =
      ref.profession === "Fisioterapia"
        ? " Fisioterapeuta em público, privado e IPSS."
        : ref.profession === "Técnico de Saúde"
          ? " Inclui TDT, terapeuta ocupacional, psicomotricidade e afins."
          : ref.profession === "Enfermagem"
            ? " Emprego enfermagem em todos os distritos."
            : "";
    return `Emprego de ${phrase} em Portugal — ${n} activas.${extra} Filtra por distrito e cria alertas no VagaSaúde.`;
  }
  return `Emprego na saúde em ${ref.district} — ${n} activas. Enfermagem, medicina, fisioterapia e mais; pesquisa e alertas no VagaSaúde.`;
}

export function buildItemListJsonLd(ref: CategoryRef, jobs: Job[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ref.title,
    url: absoluteUrl(ref.path),
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, 50).map((job, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/vagas/${job.slug}`),
      name: job.title,
    })),
  };
}

export function relatedCategoryLinks(
  all: CategoryRef[],
  current: CategoryRef,
  limit = 6,
): CategoryRef[] {
  if (current.kind === "combo" && current.profession) {
    return all
      .filter(
        (item) =>
          item.kind === "combo" &&
          item.profession === current.profession &&
          item.path !== current.path,
      )
      .slice(0, limit);
  }
  if (current.kind === "profession") {
    return all
      .filter(
        (item) =>
          item.kind === "combo" && item.profession === current.profession,
      )
      .slice(0, limit);
  }
  if (current.kind === "district") {
    return all
      .filter(
        (item) => item.kind === "combo" && item.district === current.district,
      )
      .slice(0, limit);
  }
  return [];
}

export function siblingDistrictLinks(
  all: CategoryRef[],
  current: CategoryRef,
  limit = 6,
): CategoryRef[] {
  if (current.kind !== "combo" || !current.profession) return [];
  return all
    .filter(
      (item) =>
        item.kind === "combo" &&
        item.profession === current.profession &&
        item.path !== current.path,
    )
    .slice(0, limit);
}
