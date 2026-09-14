import Link from "next/link";

type Variant = "aside" | "inline";

/**
 * CTA curto para guias de candidatura — sem cards decorativos no hero.
 */
export function ArticlesGuideCta({
  variant = "aside",
  profession,
  sector,
}: {
  variant?: Variant;
  profession?: string;
  sector?: string;
}) {
  const isPublic =
    sector?.toLowerCase().includes("público") ||
    sector?.toLowerCase().includes("publico");
  const isNursing =
    profession?.toLowerCase().includes("enferm") ||
    profession?.toLowerCase().includes("auxiliar");

  const primaryHref = isPublic
    ? "/artigos/ler-aviso-concurso-bep"
    : isNursing
      ? "/artigos/cv-enfermagem-saude"
      : "/artigos";
  const primaryLabel = isPublic
    ? "Como ler um aviso de concurso"
    : isNursing
      ? "CV para enfermagem e saúde"
      : "Guias de candidatura";

  if (variant === "inline") {
    return (
      <p className="text-sm leading-6 text-muted">
        Antes de te candidatares:{" "}
        <Link href={primaryHref} className="font-bold text-primary hover:underline">
          {primaryLabel}
        </Link>
        {" · "}
        <Link href="/artigos" className="font-semibold text-primary hover:underline">
          ver todos os guias
        </Link>
      </p>
    );
  }

  return (
    <div className="content-card p-5">
      <h2 className="font-extrabold">Antes de te candidatares</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        CV, carta, concursos e alertas — guias curtos para emprego em saúde.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link
            href={primaryHref}
            className="font-semibold text-primary hover:underline"
          >
            {primaryLabel}
          </Link>
        </li>
        <li>
          <Link
            href="/artigos"
            className="font-semibold text-primary hover:underline"
          >
            Ver todos os guias
          </Link>
        </li>
      </ul>
    </div>
  );
}
