/**
 * Ligação contextual para o site de educação do mesmo dono (VagaEducação).
 * Só para landings de profissão (página 1) com categoria equivalente na
 * educação; destinos verificados (200, 5 ou mais vagas) em 2026-11-19.
 */
const EDU_LINKS: Record<string, { before: string; anchor: string; href: string }> = {
  "Psicologia": {
    before: "Psicólogos também são contratados por escolas e redes de ensino: ",
    anchor: "vagas de psicopedagogia e apoio na VagaEducação",
    href: "https://vagaeducacao.com.br/vagas/psicopedagogia-e-apoio",
  },
  "Auxiliares": {
    before: "Quer trabalhar em escolas? Veja as ",
    anchor: "vagas de auxiliar e monitor escolar na VagaEducação",
    href: "https://vagaeducacao.com.br/vagas/auxiliar-e-monitor-escolar",
  },
  "Formação": {
    before: "Instrutores e formadores também têm vagas na educação: ",
    anchor: "vagas de instrutor e ensino técnico na VagaEducação",
    href: "https://vagaeducacao.com.br/vagas/instrutor-e-ensino-tecnico",
  },
  "Administrativo": {
    before: "Há também vagas administrativas em escolas e faculdades: ",
    anchor: "vagas de administrativo escolar na VagaEducação",
    href: "https://vagaeducacao.com.br/vagas/administrativo-escolar",
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
