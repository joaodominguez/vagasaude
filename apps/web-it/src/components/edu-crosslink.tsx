/**
 * Ligação contextual para o site de educação do mesmo dono (OfferteScuola).
 * Só para landings de profissão (página 1) com categoria equivalente na
 * educação; destinos verificados (200, 5 ou mais vagas) em 2026-11-19.
 */
const EDU_LINKS: Record<string, { before: string; anchor: string; href: string }> = {
  "Psicologia": {
    before: "Anche le scuole cercano psicologi e pedagogisti: ",
    anchor: "offerte per pedagogista e psicologo su OfferteScuola",
    href: "https://offertescuola.it/offerte/pedagogista-e-psicologo",
  },
  "Logopedia e riabilitazione": {
    before: "Educatori professionali e figure di supporto sono richiesti anche in ambito scolastico: ",
    anchor: "offerte per educatore e assistente educativo su OfferteScuola",
    href: "https://offertescuola.it/offerte/educatore-e-assistente-educativo",
  },
  "Servizio sociale": {
    before: "Anche in ambito educativo c'è richiesta di operatori sociali ed educatori: ",
    anchor: "offerte per educatore e assistente educativo su OfferteScuola",
    href: "https://offertescuola.it/offerte/educatore-e-assistente-educativo",
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
