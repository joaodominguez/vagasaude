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
  {
    id: "cerba",
    name: "Cerba HealthCare Italia - Lavora con noi",
    shortName: "Cerba HealthCare",
    url: "https://cerbahealthcare-career.talent-soft.com/offre-de-emploi/liste-toutes-offres.aspx?LCID=1040",
    sector: "Privato",
  },
  {
    id: "fresenius",
    name: "NephroCare - Fresenius Medical Care Italia",
    shortName: "NephroCare",
    url: "https://jobs.freseniusmedicalcare.com/it/",
    sector: "Privato",
  },
  {
    id: "affidea",
    name: "Affidea Italia - Lavora con noi",
    shortName: "Affidea",
    url: "https://affideaitaly.recruitee.com/",
    sector: "Privato",
  },
  {
    id: "maugeri",
    name: "ICS Maugeri - Lavora con noi",
    shortName: "ICS Maugeri",
    url: "https://carriere.icsmaugeri.it/",
    sector: "Privato",
  },
  {
    id: "auxologico",
    name: "Istituto Auxologico Italiano - Lavora con noi",
    shortName: "Auxologico",
    url: "https://www.auxologico.it/lavora-con-noi/posizioni-aperte",
    sector: "Privato",
  },
  {
    id: "fatebenefratelli",
    name: "Fatebenefratelli - Lavora con noi",
    shortName: "Fatebenefratelli",
    url: "https://www.fatebenefratelli.it/lavora-con-noi",
    sector: "Privato",
  },
];

export const SOURCE_META = Object.fromEntries(
  JOB_SOURCES.map((source) => [
    source.id,
    { name: source.name, url: source.url, sector: source.sector },
  ]),
) as Record<string, { name: string; url: string; sector: string }>;
