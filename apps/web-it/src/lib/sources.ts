export type JobSourceMeta = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  sector: "Pubblico" | "Privato" | "Accreditato";
  /** Senza logo, la scheda partner mostra il nome. */
  logo?: string;
};

/**
 * Fonti degli annunci. VUOTO per ora: le fonti italiane non sono ancora state
 * decise (vedi docs/it/). Ogni scraper in scrapers-it/sources/ deve avere qui
 * una voce con lo stesso `id`. Non aggiungere loghi senza verificarne la licenza
 * d'uso. Esempio:
 *
 *   { id: "esempio", name: "Esempio - Concorsi ASL", shortName: "Esempio",
 *     url: "https://example.org/", sector: "Pubblico" }
 */
export const JOB_SOURCES: JobSourceMeta[] = [
  {
    id: "veneto-concorsi",
    name: "Veneto - Concorsi, Avvisi e Incarichi (Azienda Zero)",
    shortName: "Veneto Concorsi",
    url: "https://aziendazero.concorsieavvisi.it/",
    sector: "Pubblico",
    logo: "/partners/azienda-zero-veneto.png",
  },
  {
    id: "inpa",
    name: "inPA - Portale del Reclutamento",
    shortName: "inPA",
    url: "https://www.inpa.gov.it/bandi-e-avvisi/",
    sector: "Pubblico",
  },
  {
    id: "gu-s4",
    name: "Gazzetta Ufficiale - 4ª Serie Speciale Concorsi ed esami",
    shortName: "Gazzetta Ufficiale",
    url: "https://www.gazzettaufficiale.it/",
    sector: "Pubblico",
    // Logo ufficiale (resources/img/logo.png, pensato per sfondo scuro) su riquadro blu scuro.
    logo: "/partners/gazzetta-ufficiale.svg",
  },
  {
    id: "humanitas",
    name: "Humanitas - Lavora con noi",
    shortName: "Humanitas",
    url: "https://jobs.humanitas.it/",
    sector: "Privato",
  },
  {
    id: "clariane",
    name: "Clariane Italia (Korian) - Carriere",
    shortName: "Clariane",
    url: "https://carriere.clariane.it/",
    sector: "Privato",
  },
  {
    id: "anicura",
    name: "AniCura Italia - Lavora con noi",
    shortName: "AniCura",
    url: "https://jobs.anicura.it/",
    sector: "Privato",
  },
];

export const SOURCE_META = Object.fromEntries(
  JOB_SOURCES.map((source) => [
    source.id,
    { name: source.name, url: source.url, sector: source.sector },
  ]),
) as Record<string, { name: string; url: string; sector: string }>;
