/**
 * Ligação contextual para o site de educação do mesmo dono (VagaEducação).
 * Só para landings de profissão (página 1) com categoria equivalente na
 * educação; destinos verificados (200, 5 ou mais vagas) em 2026-11-19.
 */
const EDU_LINKS: Record<string, { before: string; anchor: string; href: string }> = {
  "Psicologia": {
    before: "Os psicólogos também têm vagas em escolas e colégios: ",
    anchor: "vagas de técnico especializado na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/tecnico-especializado",
  },
  "Assistência Social": {
    before: "Quem trabalha em ação social também encontra vagas em contexto escolar: ",
    anchor: "vagas de técnico especializado na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/tecnico-especializado",
  },
  "Técnico de Saúde": {
    before: "Terapeutas da fala e terapeutas ocupacionais também são procurados por escolas: ",
    anchor: "vagas de técnico especializado na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/tecnico-especializado",
  },
  "Auxiliares": {
    before: "À procura de trabalho em escolas e creches? Veja as ",
    anchor: "vagas de auxiliar de educação na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/auxiliar-de-educacao",
  },
  "Formação": {
    before: "Os formadores também têm vagas na educação: ",
    anchor: "vagas de formador na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/formador",
  },
  "Administrativo": {
    before: "Há também vagas administrativas em escolas e colégios: ",
    anchor: "vagas de gestão e administrativo na VagaEducação",
    href: "https://vagaeducacao.pt/vagas/gestao-administrativo",
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
