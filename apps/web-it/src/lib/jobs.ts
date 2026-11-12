export type Job = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Pubblico" | "Privato" | "Accreditato";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
  /** Ultima volta in cui lo scraper ha restituito l'offerta (base del validThrough). */
  lastSeenAt?: string | null;
  /** Fonte di origine. */
  source?: string;
  /** ID dell'offerta nella fonte (identifier del JobPosting). */
  sourceId?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationUrl: string;
  /** Retribuzione indicata nella fonte (se presente). */
  salary?: string | null;
  featured?: boolean;
};

/** Offerte di dimostrazione (solo sviluppo; in produzione non vengono mai mostrate). Dati di fantasia. */
export const jobs: Job[] = [
  {
    slug: "infermiere-pronto-soccorso-ospedale-di-esempio-milano",
    title: "Infermiere — Pronto Soccorso",
    company: "Ospedale di Esempio",
    district: "Lombardia",
    city: "Milano",
    sector: "Privato",
    contract: "Tempo indeterminato",
    profession: "Infermieristica",
    publishedLabel: "Oggi",
    publishedAt: "2026-08-02",
    description:
      "Offerta di esempio (dati di fantasia): si cerca un infermiere da inserire nell'équipe del Pronto Soccorso, per garantire assistenza di qualità e la sicurezza dei pazienti.",
    requirements: [
      "Laurea in Infermieristica e iscrizione all'albo professionale.",
      "Esperienza in area critica (titolo preferenziale).",
      "Capacità di lavorare in squadra e di gestire lo stress.",
      "Disponibilità a lavorare su turni.",
    ],
    responsibilities: [
      "Erogare assistenza infermieristica di qualità.",
      "Valutare e monitorare le condizioni cliniche dei pazienti.",
      "Somministrare le terapie ed eseguire le procedure infermieristiche.",
      "Registrare gli interventi nella cartella clinica.",
    ],
    applicationUrl: "https://example.com/",
    featured: true,
  },
  {
    slug: "dirigente-medico-medicina-interna-asl-di-esempio-roma",
    title: "Dirigente medico — Medicina interna",
    company: "ASL di Esempio",
    district: "Lazio",
    city: "Roma",
    sector: "Pubblico",
    contract: "Tempo determinato",
    profession: "Medicina",
    publishedLabel: "Oggi",
    publishedAt: "2026-08-02",
    description:
      "Offerta di esempio (dati di fantasia): incarico a tempo determinato per dirigente medico presso un presidio ospedaliero, con attenzione alla continuità assistenziale.",
    requirements: [
      "Laurea in Medicina e Chirurgia e specializzazione in Medicina interna o disciplina equipollente.",
      "Iscrizione all'albo dei medici.",
    ],
    responsibilities: [
      "Gestire i pazienti ricoverati e le attività ambulatoriali.",
      "Collaborare con il personale infermieristico e con i servizi sociali.",
    ],
    applicationUrl: "https://example.com/",
  },
  {
    slug: "oss-residenza-per-anziani-esempio-srl-napoli",
    title: "OSS — Residenza per anziani",
    company: "Esempio Srl",
    district: "Campania",
    city: "Napoli",
    sector: "Accreditato",
    contract: "Turni",
    profession: "OSS",
    publishedLabel: "Ieri",
    publishedAt: "2026-08-01",
    description:
      "Offerta di esempio (dati di fantasia): una residenza per anziani cerca un operatore socio sanitario (OSS) per turni a rotazione, inclusi i fine settimana.",
    requirements: [
      "Attestato di qualifica di Operatore Socio Sanitario.",
      "Disponibilità su turni.",
    ],
    responsibilities: [
      "Supportare gli ospiti nell'igiene personale, nella mobilizzazione e nell'alimentazione.",
      "Collaborare con il personale infermieristico.",
    ],
    applicationUrl: "https://example.com/",
  },
];

export { districts, professions } from "@/lib/taxonomies";

export function getJob(slug: string) {
  return jobs.find((job) => job.slug === slug);
}
