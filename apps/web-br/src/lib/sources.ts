export type JobSourceMeta = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  sector: "Público" | "Privado" | "Filantrópico";
  logo: string;
};

/**
 * Fontes BR — a preencher quando os scrapers do mercado brasileiro estiverem prontos.
 * Mantém a mesma forma que apps/web (PT) para o backoffice e partners.
 */
export const JOB_SOURCES: JobSourceMeta[] = [
  // Exemplos a ligar depois (não ativos):
  // { id: "gupy_saude", name: "Gupy (saúde)", shortName: "Gupy", url: "https://www.gupy.io/", sector: "Privado", logo: "/partners/placeholder.svg" },
  // { id: "catho_saude", name: "Catho Saúde", shortName: "Catho", url: "https://www.catho.com.br/", sector: "Privado", logo: "/partners/placeholder.svg" },
  // { id: "vagas_com", name: "Vagas.com", shortName: "Vagas", url: "https://www.vagas.com.br/", sector: "Privado", logo: "/partners/placeholder.svg" },
];

export function getSourceMeta(id: string) {
  return JOB_SOURCES.find((source) => source.id === id) ?? null;
}

export const SOURCE_META = Object.fromEntries(
  JOB_SOURCES.map((source) => [
    source.id,
    { name: source.name, url: source.url, sector: source.sector },
  ]),
) as Record<string, { name: string; url: string; sector: string }>;
