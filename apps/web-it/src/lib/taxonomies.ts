import { regions as italyRegions } from "@/lib/italy-map";

/**
 * Aree professionali del prodotto (Italia).
 *
 * - "OSS" = Operatore Socio Sanitario (la ricerca "OSS" ha molto volume,
 *   per questo l'etichetta e' la sigla).
 * - "Tecnici sanitari" raggruppa le professioni sanitarie tecniche (laboratorio
 *   biomedico, radiologia, neurofisiopatologia, ortottica...).
 * - "Logopedia e riabilitazione" include logopedisti, terapisti occupazionali
 *   e educatori professionali sanitari.
 *
 * ATTENZIONE: queste etichette devono coincidere con quelle restituite da
 * `guess_profession` in scrapers-it/common/normalize.py e con `PROFESSION_RULES`
 * in src/lib/job-store.ts. "Altro" e' il fallback (aggiunto in categories.ts).
 */
export const professions = [
  "Infermieristica",
  "Medicina",
  "OSS",
  "Fisioterapia",
  "Tecnici sanitari",
  "Ostetricia",
  "Farmacia",
  "Psicologia",
  "Nutrizione e dietistica",
  "Odontoiatria",
  "Logopedia e riabilitazione",
  "Ottica e audiometria",
  "Veterinaria",
  "Servizio sociale",
  "Formazione",
  "Gestione e supporto",
  "Amministrativo",
] as const;

/** "Accreditato" = strutture private accreditate con il SSN (case di cura, RSA, enti del terzo settore...). */
export const sectors = ["Pubblico", "Privato", "Accreditato"] as const;

/**
 * Le 20 regioni italiane. Il campo interno si chiama ancora `district`
 * (contratto con gli scraper: `location_district`).
 */
export const districts = [...italyRegions] as const;
