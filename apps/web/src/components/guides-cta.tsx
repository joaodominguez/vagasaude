import Link from "next/link";
import {
  getArticle,
  listArticlesByCategory,
  newsCategoryPath,
  newsPath,
} from "@/lib/news";

type Variant = "aside" | "inline";

/** Slugs dos guias em content/noticias (categoria "guias"). */
const GUIDE_CURRICULUM = "curriculo-enfermagem-saude";
const GUIDE_CONCURSO = "como-ler-aviso-concurso-saude";

/**
 * CTA curto para guias de candidatura. Só liga a guias publicados
 * (getArticle exclui rascunhos em produção); sem guias, não renderiza nada.
 */
export function GuidesCta({
  variant = "aside",
  profession,
  sector,
}: {
  variant?: Variant;
  profession?: string;
  sector?: string;
}) {
  if (listArticlesByCategory("guias").length === 0) return null;

  const isPublic = sector?.toLowerCase().includes("público");
  const p = profession?.toLowerCase() ?? "";
  const isClinical =
    p.includes("enferm") || p.includes("auxiliar") || p.includes("técnico");

  let primaryHref = newsCategoryPath("guias");
  let primaryLabel = "Guias de candidatura";
  if (isPublic && getArticle(GUIDE_CONCURSO)) {
    primaryHref = newsPath(GUIDE_CONCURSO);
    primaryLabel = "Como ler um aviso de concurso";
  } else if (isClinical && getArticle(GUIDE_CURRICULUM)) {
    primaryHref = newsPath(GUIDE_CURRICULUM);
    primaryLabel = "Currículo para enfermagem e saúde";
  }
  const allHref = newsCategoryPath("guias");

  if (variant === "inline") {
    return (
      <p className="text-sm leading-6 text-muted">
        Antes de te candidatares:{" "}
        <Link href={primaryHref} className="font-bold text-primary hover:underline">
          {primaryLabel}
        </Link>
        {primaryHref !== allHref && (
          <>
            {" · "}
            <Link href={allHref} className="font-semibold text-primary hover:underline">
              ver todos os guias
            </Link>
          </>
        )}
      </p>
    );
  }

  return (
    <div className="content-card p-5">
      <h2 className="font-extrabold">Antes de te candidatares</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Currículo, carta, avisos de concurso e alertas: guias curtos para
        emprego em saúde em Portugal.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link href={primaryHref} className="font-semibold text-primary hover:underline">
            {primaryLabel}
          </Link>
        </li>
        {primaryHref !== allHref && (
          <li>
            <Link href={allHref} className="font-semibold text-primary hover:underline">
              Ver todos os guias
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
