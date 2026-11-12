import type { Job } from "@/lib/jobs";

/**
 * Province per regione, usate per le landing di secondo livello
 * (/offerte/<regione>/<provincia>). Elenco delle province vigenti
 * (sigle automobilistiche); le denominazioni storiche sarde (Medio Campidano,
 * Ogliastra, Carbonia-Iglesias, Olbia-Tempio) non sono incluse.
 * TODO: verificare l'assetto delle province sarde dopo la riforma regionale del 2025.
 * Generato da scrapers-it/common/normalize.py: tenere i due elenchi allineati.
 */
export const PROVINCES_BY_REGION: Record<string, readonly string[]> = {
  "Abruzzo": ["Chieti", "L'Aquila", "Pescara", "Teramo"],
  "Basilicata": ["Matera", "Potenza"],
  "Calabria": ["Catanzaro", "Cosenza", "Crotone", "Reggio Calabria", "Vibo Valentia"],
  "Campania": ["Avellino", "Benevento", "Caserta", "Napoli", "Salerno"],
  "Emilia-Romagna": ["Bologna", "Ferrara", "Forlì-Cesena", "Modena", "Parma", "Piacenza", "Ravenna", "Reggio Emilia", "Rimini"],
  "Friuli-Venezia Giulia": ["Gorizia", "Pordenone", "Trieste", "Udine"],
  "Lazio": ["Frosinone", "Latina", "Rieti", "Roma", "Viterbo"],
  "Liguria": ["Genova", "Imperia", "La Spezia", "Savona"],
  "Lombardia": ["Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi", "Mantova", "Milano", "Monza e Brianza", "Pavia", "Sondrio", "Varese"],
  "Marche": ["Ancona", "Ascoli Piceno", "Fermo", "Macerata", "Pesaro e Urbino"],
  "Molise": ["Campobasso", "Isernia"],
  "Piemonte": ["Alessandria", "Asti", "Biella", "Cuneo", "Novara", "Torino", "Verbano-Cusio-Ossola", "Vercelli"],
  "Puglia": ["Bari", "Barletta-Andria-Trani", "Brindisi", "Foggia", "Lecce", "Taranto"],
  "Sardegna": ["Cagliari", "Nuoro", "Oristano", "Sassari", "Sud Sardegna"],
  "Sicilia": ["Agrigento", "Caltanissetta", "Catania", "Enna", "Messina", "Palermo", "Ragusa", "Siracusa", "Trapani"],
  "Toscana": ["Arezzo", "Firenze", "Grosseto", "Livorno", "Lucca", "Massa-Carrara", "Pisa", "Pistoia", "Prato", "Siena"],
  "Trentino-Alto Adige": ["Bolzano", "Trento"],
  "Umbria": ["Perugia", "Terni"],
  "Valle d'Aosta": ["Aosta"],
  "Veneto": ["Belluno", "Padova", "Rovigo", "Treviso", "Venezia", "Verona", "Vicenza"],
};

/** Sigla automobilistica -> provincia. */
const PROVINCE_BY_SIGLA: Record<string, string> = {
  AG: "Agrigento", AL: "Alessandria", AN: "Ancona", AO: "Aosta", AP: "Ascoli Piceno", AQ: "L'Aquila", AR: "Arezzo", AT: "Asti", AV: "Avellino", BA: "Bari", BG: "Bergamo", BI: "Biella", BL: "Belluno", BN: "Benevento", BO: "Bologna", BR: "Brindisi", BS: "Brescia", BT: "Barletta-Andria-Trani", BZ: "Bolzano", CA: "Cagliari", CB: "Campobasso", CE: "Caserta", CH: "Chieti", CL: "Caltanissetta", CN: "Cuneo", CO: "Como", CR: "Cremona", CS: "Cosenza", CT: "Catania", CZ: "Catanzaro", EN: "Enna", FC: "Forlì-Cesena", FE: "Ferrara", FG: "Foggia", FI: "Firenze", FM: "Fermo", FR: "Frosinone", GE: "Genova", GO: "Gorizia", GR: "Grosseto", IM: "Imperia", IS: "Isernia", KR: "Crotone", LC: "Lecco", LE: "Lecce", LI: "Livorno", LO: "Lodi", LT: "Latina", LU: "Lucca", MB: "Monza e Brianza", MC: "Macerata", ME: "Messina", MI: "Milano", MN: "Mantova", MO: "Modena", MS: "Massa-Carrara", MT: "Matera", NA: "Napoli", NO: "Novara", NU: "Nuoro", OR: "Oristano", PA: "Palermo", PC: "Piacenza", PD: "Padova", PE: "Pescara", PG: "Perugia", PI: "Pisa", PN: "Pordenone", PO: "Prato", PR: "Parma", PT: "Pistoia", PU: "Pesaro e Urbino", PV: "Pavia", PZ: "Potenza", RA: "Ravenna", RC: "Reggio Calabria", RE: "Reggio Emilia", RG: "Ragusa", RI: "Rieti", RM: "Roma", RN: "Rimini", RO: "Rovigo", SA: "Salerno", SI: "Siena", SO: "Sondrio", SP: "La Spezia", SR: "Siracusa", SS: "Sassari", SU: "Sud Sardegna", SV: "Savona", TA: "Taranto", TE: "Teramo", TN: "Trento", TO: "Torino", TP: "Trapani", TR: "Terni", TS: "Trieste", TV: "Treviso", UD: "Udine", VA: "Varese", VB: "Verbano-Cusio-Ossola", VC: "Vercelli", VE: "Venezia", VI: "Vicenza", VR: "Verona", VT: "Viterbo", VV: "Vibo Valentia",
};

/** Alias (chiave normalizzata senza accenti) -> provincia canonica. */
const PROVINCE_ALIASES: Record<string, string> = {
  "agrigento": "Agrigento",
  "alessandria": "Alessandria",
  "ancona": "Ancona",
  "aosta": "Aosta",
  "aoste": "Aosta",
  "arezzo": "Arezzo",
  "ascoli piceno": "Ascoli Piceno",
  "asti": "Asti",
  "avellino": "Avellino",
  "bari": "Bari",
  "barletta andria trani": "Barletta-Andria-Trani",
  "belluno": "Belluno",
  "benevento": "Benevento",
  "bergamo": "Bergamo",
  "biella": "Biella",
  "bologna": "Bologna",
  "bolzano": "Bolzano",
  "bolzano bozen": "Bolzano",
  "bozen": "Bolzano",
  "brescia": "Brescia",
  "brindisi": "Brindisi",
  "cagliari": "Cagliari",
  "caltanissetta": "Caltanissetta",
  "campobasso": "Campobasso",
  "caserta": "Caserta",
  "catania": "Catania",
  "catanzaro": "Catanzaro",
  "cesena": "Forlì-Cesena",
  "chieti": "Chieti",
  "como": "Como",
  "cosenza": "Cosenza",
  "cremona": "Cremona",
  "crotone": "Crotone",
  "cuneo": "Cuneo",
  "enna": "Enna",
  "fermo": "Fermo",
  "ferrara": "Ferrara",
  "firenze": "Firenze",
  "foggia": "Foggia",
  "forli": "Forlì-Cesena",
  "forli cesena": "Forlì-Cesena",
  "frosinone": "Frosinone",
  "genova": "Genova",
  "gorizia": "Gorizia",
  "grosseto": "Grosseto",
  "imperia": "Imperia",
  "isernia": "Isernia",
  "l aquila": "L'Aquila",
  "la spezia": "La Spezia",
  "latina": "Latina",
  "lecce": "Lecce",
  "lecco": "Lecco",
  "livorno": "Livorno",
  "lodi": "Lodi",
  "lucca": "Lucca",
  "macerata": "Macerata",
  "mantova": "Mantova",
  "massa carrara": "Massa-Carrara",
  "matera": "Matera",
  "messina": "Messina",
  "milano": "Milano",
  "modena": "Modena",
  "monza": "Monza e Brianza",
  "monza e brianza": "Monza e Brianza",
  "napoli": "Napoli",
  "novara": "Novara",
  "nuoro": "Nuoro",
  "oristano": "Oristano",
  "padova": "Padova",
  "palermo": "Palermo",
  "parma": "Parma",
  "pavia": "Pavia",
  "perugia": "Perugia",
  "pesaro e urbino": "Pesaro e Urbino",
  "pesaro urbino": "Pesaro e Urbino",
  "pescara": "Pescara",
  "piacenza": "Piacenza",
  "pisa": "Pisa",
  "pistoia": "Pistoia",
  "pordenone": "Pordenone",
  "potenza": "Potenza",
  "prato": "Prato",
  "ragusa": "Ragusa",
  "ravenna": "Ravenna",
  "reggio calabria": "Reggio Calabria",
  "reggio di calabria": "Reggio Calabria",
  "reggio emilia": "Reggio Emilia",
  "reggio nell emilia": "Reggio Emilia",
  "rieti": "Rieti",
  "rimini": "Rimini",
  "roma": "Roma",
  "rovigo": "Rovigo",
  "salerno": "Salerno",
  "sassari": "Sassari",
  "savona": "Savona",
  "siena": "Siena",
  "siracusa": "Siracusa",
  "sondrio": "Sondrio",
  "sud sardegna": "Sud Sardegna",
  "sulcis iglesiente": "Sud Sardegna",
  "taranto": "Taranto",
  "teramo": "Teramo",
  "terni": "Terni",
  "torino": "Torino",
  "trapani": "Trapani",
  "trento": "Trento",
  "treviso": "Treviso",
  "trieste": "Trieste",
  "udine": "Udine",
  "varese": "Varese",
  "venezia": "Venezia",
  "verbania": "Verbano-Cusio-Ossola",
  "verbano cusio ossola": "Verbano-Cusio-Ossola",
  "vercelli": "Vercelli",
  "verona": "Verona",
  "vibo valentia": "Vibo Valentia",
  "vicenza": "Vicenza",
  "viterbo": "Viterbo",
};

export function normalizeKey(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function provinceSlug(province: string) {
  return normalizeKey(province).replace(/ /g, "-");
}

const REGION_BY_PROVINCE = new Map<string, string>();
const PROVINCE_BY_SLUG = new Map<string, string>();
for (const [region, list] of Object.entries(PROVINCES_BY_REGION)) {
  for (const province of list) {
    REGION_BY_PROVINCE.set(province, region);
    PROVINCE_BY_SLUG.set(provinceSlug(province), province);
  }
}

export function regionHasProvinces(region: string | null | undefined) {
  return Boolean(region && (PROVINCES_BY_REGION[region]?.length ?? 0) > 1);
}

/** Provincia a partire dallo slug dentro la sua regione (null se non appartiene). */
export function provinceFromSlug(region: string, slug: string) {
  const province = PROVINCE_BY_SLUG.get(slug);
  if (!province) return null;
  return REGION_BY_PROVINCE.get(province) === region ? province : null;
}

/**
 * Provincia di un'offerta a partire dalla località ("Milano", "Monza (MB)",
 * "Bergamo - BG"...). Restituisce solo province della regione dell'offerta,
 * per evitare falsi positivi (es. Aosta / Valle d'Aosta).
 * Nota: i comuni che non sono capoluogo non sono mappati su una provincia;
 * TODO: aggiungere una tabella comune -> provincia (ISTAT) quando ci saranno fonti reali.
 */
export function provinceOfJob(job: Pick<Job, "city" | "district">): string | null {
  const accept = (province: string | undefined) =>
    province && REGION_BY_PROVINCE.get(province) === job.district
      ? province
      : null;

  const raw = job.city ?? "";

  // 1) Sigla automobilistica tra parentesi o dopo separatore: "(MI)", ", MI", "- MI".
  const sigla = raw.match(/(?:\(|,\s*|-\s*|\s)([A-Z]{2})\)?\s*$/);
  if (sigla) {
    const hit = accept(PROVINCE_BY_SIGLA[sigla[1]]);
    if (hit) return hit;
  }

  const key = normalizeKey(raw);
  if (!key) return null;

  // 2) Nome esatto.
  const exact = accept(PROVINCE_ALIASES[key]);
  if (exact) return exact;

  // 3) Ogni frammento ("Milano (capoluogo)", "Provincia, Comune").
  const parts = raw
    .split(/[,;()\-–—/|]/)
    .map((part) => normalizeKey(part))
    .filter(Boolean);
  for (const part of parts) {
    const byName = accept(PROVINCE_ALIASES[part]);
    if (byName) return byName;
  }

  // 4) Nome di provincia come parola intera dentro il testo (alias piu lungo).
  const padded = ` ${key} `;
  let best: { province: string; len: number } | null = null;
  for (const [alias, province] of Object.entries(PROVINCE_ALIASES)) {
    if (!padded.includes(` ${alias} `)) continue;
    if (!accept(province)) continue;
    if (!best || alias.length > best.len) best = { province, len: alias.length };
  }
  return best?.province ?? null;
}

const provinceCache = new WeakMap<object, string | null>();

/** Come provinceOfJob, con cache per oggetto (le liste vengono filtrate molte volte). */
export function jobProvince(job: Job): string | null {
  const cached = provinceCache.get(job);
  if (cached !== undefined) return cached;
  const value = provinceOfJob(job);
  provinceCache.set(job, value);
  return value;
}
