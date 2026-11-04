import Link from "next/link";
import { getArticle, listNewsCategories, newsCategoryPath, newsPath } from "@/lib/news";

const GUIDES = {
  convocatoria: {
    slug: "como-leer-convocatoria-oposicion",
    label: "Cómo leer una convocatoria de oposición",
  },
  curriculum: {
    slug: "curriculum-sanidad",
    label: "Currículum para enfermería y profesiones sanitarias",
  },
  carta: {
    slug: "carta-presentacion-sanidad",
    label: "Carta de presentación para hospitales y clínicas",
  },
  alertas: {
    slug: "alertas-empleo-sanidad",
    label: "Cómo usar las alertas de empleo",
  },
} as const;

type GuideKey = keyof typeof GUIDES;

/** Profesiones donde el currículum con colegiación/formación reglada es lo habitual. */
const REGULATED = new Set([
  "Enfermería",
  "Medicina",
  "TCAE",
  "Fisioterapia",
  "Técnico sanitario",
  "Farmacia",
  "Técnico de farmacia",
  "Psicología",
  "Nutrición",
  "Odontología",
  "Veterinaria",
]);

/**
 * CTA corto a las guías de candidatura (equivalente a ArticlesGuideCta de BR).
 * Solo enlaza a guías publicadas: los borradores no existen en producción, así
 * que si no hay ninguna visible no se renderiza nada (evita enlaces 404).
 */
export function GuiasCta({
  variant = "aside",
  profession,
  sector,
}: {
  variant?: "aside" | "inline";
  profession?: string;
  sector?: string;
}) {
  const order: GuideKey[] =
    sector === "Público"
      ? ["convocatoria", "curriculum", "carta", "alertas"]
      : profession && REGULATED.has(profession)
        ? ["curriculum", "carta", "alertas", "convocatoria"]
        : ["carta", "curriculum", "alertas", "convocatoria"];
  const primary = order.map((key) => GUIDES[key]).find((g) => getArticle(g.slug));
  if (!primary) return null;
  const hasGuidesCategory = listNewsCategories().includes("guias");
  const allHref = hasGuidesCategory ? newsCategoryPath("guias") : "/noticias";

  if (variant === "inline") {
    return (
      <p className="text-sm leading-6 text-muted">
        Antes de inscribirte:{" "}
        <Link href={newsPath(primary.slug)} className="font-bold text-primary hover:underline">
          {primary.label}
        </Link>
        {" · "}
        <Link href={allHref} className="font-semibold text-primary hover:underline">
          ver todas las guías
        </Link>
      </p>
    );
  }

  return (
    <div className="content-card p-5">
      <h2 className="font-extrabold">Antes de inscribirte</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Currículum, carta de presentación, convocatorias y alertas: guías cortas
        para buscar empleo sanitario en España.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link href={newsPath(primary.slug)} className="font-semibold text-primary hover:underline">
            {primary.label}
          </Link>
        </li>
        <li>
          <Link href={allHref} className="font-semibold text-primary hover:underline">
            Ver todas las guías
          </Link>
        </li>
      </ul>
    </div>
  );
}
