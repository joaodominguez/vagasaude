/**
 * Ligação contextual para o site de educação do mesmo dono (VacantesEducación).
 * Só para landings de profissão (página 1) com categoria equivalente na
 * educação; destinos verificados (200, 5 ou mais vagas) em 2026-11-19.
 */
const EDU_LINKS: Record<string, { before: string; anchor: string; href: string }> = {
  "Psicología": {
    before: "Los psicólogos también tienen ofertas en centros educativos: ",
    anchor: "empleo de orientación y psicopedagogía en VacantesEducación",
    href: "https://vacanteseducacion.es/empleo/orientacion-y-psicopedagogia",
  },
  "Trabajo social": {
    before: "Trabajadores y educadores sociales también encuentran ofertas en el ámbito educativo: ",
    anchor: "empleo de orientación y psicopedagogía en VacantesEducación",
    href: "https://vacanteseducacion.es/empleo/orientacion-y-psicopedagogia",
  },
  "Técnico sanitario": {
    before: "Logopedas y especialistas en audición y lenguaje también se buscan en centros educativos: ",
    anchor: "empleo en educación especial en VacantesEducación",
    href: "https://vacanteseducacion.es/empleo/educacion-especial",
  },
  "Formación": {
    before: "Los formadores también tienen ofertas en educación: ",
    anchor: "empleo de formador en VacantesEducación",
    href: "https://vacanteseducacion.es/empleo/formador",
  },
  "Administrativo": {
    before: "También hay ofertas administrativas en centros educativos: ",
    anchor: "empleo de dirección y administración educativa en VacantesEducación",
    href: "https://vacanteseducacion.es/empleo/direccion-y-administracion",
  },
};

export function EduCrosslink({ profession }: { profession?: string | null }) {
  const entry = profession ? EDU_LINKS[profession] : undefined;
  if (!entry) return null;
  return (
    <p className="content-card p-5 text-sm leading-6 text-muted">
      {entry.before}
      <a href={entry.href} className="font-semibold text-primary hover:underline">
        {entry.anchor}
      </a>
      .
    </p>
  );
}
