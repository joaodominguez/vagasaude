import type { Job } from "@/lib/jobs";

/**
 * Provincias de las comunidades con landings de segundo nivel
 * (/empleo/<comunidad>/<provincia>). Las comunidades uniprovinciales
 * (Madrid, Asturias, Murcia…) no necesitan este nivel.
 */
export const PROVINCES_BY_REGION: Record<string, readonly string[]> = {
  "Andalucía": ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"],
  "Castilla y León": ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
  "Galicia": ["A Coruña", "Lugo", "Ourense", "Pontevedra"],
  "Castilla-La Mancha": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"],
  "Cataluña": ["Barcelona", "Girona", "Lleida", "Tarragona"],
  "Comunidad Valenciana": ["Alicante", "Castellón", "Valencia"],
  "Canarias": ["Las Palmas", "Santa Cruz de Tenerife"],
  "Aragón": ["Huesca", "Teruel", "Zaragoza"],
  "Extremadura": ["Badajoz", "Cáceres"],
  "País Vasco": ["Álava", "Bizkaia", "Gipuzkoa"],
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
const PROVINCE_BY_SLUG = new Map<string, string>(); // `${regionSlug-less}` → provincia
for (const [region, list] of Object.entries(PROVINCES_BY_REGION)) {
  for (const province of list) {
    REGION_BY_PROVINCE.set(province, region);
    PROVINCE_BY_SLUG.set(provinceSlug(province), province);
  }
}

export function regionHasProvinces(region: string | null | undefined) {
  return Boolean(region && PROVINCES_BY_REGION[region]);
}

/** Provincia a partir del slug dentro de su comunidad (null si no pertenece). */
export function provinceFromSlug(region: string, slug: string) {
  const province = PROVINCE_BY_SLUG.get(slug);
  if (!province) return null;
  return REGION_BY_PROVINCE.get(province) === region ? province : null;
}

/** Alias de nombre de provincia (castellano / cooficial / variantes habituales). */
const PROVINCE_ALIASES: Record<string, string> = {
  almeria: "Almería",
  cadiz: "Cádiz",
  cordoba: "Córdoba",
  granada: "Granada",
  huelva: "Huelva",
  jaen: "Jaén",
  malaga: "Málaga",
  sevilla: "Sevilla",
  avila: "Ávila",
  burgos: "Burgos",
  leon: "León",
  palencia: "Palencia",
  salamanca: "Salamanca",
  segovia: "Segovia",
  soria: "Soria",
  valladolid: "Valladolid",
  zamora: "Zamora",
  "a coruna": "A Coruña",
  coruna: "A Coruña",
  "la coruna": "A Coruña",
  lugo: "Lugo",
  ourense: "Ourense",
  orense: "Ourense",
  pontevedra: "Pontevedra",
  albacete: "Albacete",
  "ciudad real": "Ciudad Real",
  cuenca: "Cuenca",
  guadalajara: "Guadalajara",
  toledo: "Toledo",
  barcelona: "Barcelona",
  girona: "Girona",
  gerona: "Girona",
  lleida: "Lleida",
  lerida: "Lleida",
  tarragona: "Tarragona",
  alicante: "Alicante",
  alacant: "Alicante",
  castellon: "Castellón",
  castello: "Castellón",
  valencia: "Valencia",
  "las palmas": "Las Palmas",
  "santa cruz de tenerife": "Santa Cruz de Tenerife",
  huesca: "Huesca",
  teruel: "Teruel",
  zaragoza: "Zaragoza",
  badajoz: "Badajoz",
  caceres: "Cáceres",
  alava: "Álava",
  araba: "Álava",
  bizkaia: "Bizkaia",
  vizcaya: "Bizkaia",
  gipuzkoa: "Gipuzkoa",
  guipuzcoa: "Gipuzkoa",
};

/** Prefijo de código postal (2 primeras cifras) → provincia. */
const POSTAL_PREFIX: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz",
  "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
  "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva",
  "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida", "27": "Lugo",
  "29": "Málaga", "32": "Ourense", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "40": "Segovia", "41": "Sevilla",
  "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia",
  "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza",
};

/** Ciudades y municipios principales (clave normalizada) → provincia. */
const CITY_TO_PROVINCE: Record<string, string> = {};
function addCities(province: string, cities: string[]) {
  for (const city of cities) CITY_TO_PROVINCE[normalizeKey(city)] = province;
}

// Andalucía
addCities("Almería", ["Almería", "El Ejido", "Roquetas de Mar", "Níjar", "Vícar", "Adra", "Huércal-Overa", "Vera", "Berja", "Albox", "Cuevas del Almanzora"]);
addCities("Cádiz", ["Cádiz", "Jerez de la Frontera", "Algeciras", "San Fernando", "El Puerto de Santa María", "Chiclana de la Frontera", "Sanlúcar de Barrameda", "La Línea de la Concepción", "Puerto Real", "Barbate", "Rota", "Arcos de la Frontera", "Ubrique", "San Roque", "Los Barrios", "Conil de la Frontera", "Villamartín"]);
addCities("Córdoba", ["Córdoba", "Lucena", "Puente Genil", "Montilla", "Priego de Córdoba", "Cabra", "Baena", "Palma del Río", "Pozoblanco", "Peñarroya-Pueblonuevo"]);
addCities("Granada", ["Granada", "Motril", "Almuñécar", "Armilla", "Maracena", "Loja", "Baza", "Guadix", "Churriana de la Vega", "Las Gabias", "Santa Fe", "Atarfe", "Albolote"]);
addCities("Huelva", ["Huelva", "Lepe", "Almonte", "Isla Cristina", "Ayamonte", "Moguer", "Bollullos Par del Condado", "Valverde del Camino", "Aljaraque", "Punta Umbría", "Cartaya", "La Palma del Condado"]);
addCities("Jaén", ["Jaén", "Linares", "Úbeda", "Andújar", "Martos", "Alcalá la Real", "Bailén", "Baeza", "Alcaudete", "Cazorla"]);
addCities("Málaga", ["Málaga", "Marbella", "Vélez-Málaga", "Fuengirola", "Torremolinos", "Benalmádena", "Mijas", "Estepona", "Ronda", "Antequera", "Rincón de la Victoria", "Alhaurín de la Torre", "Alhaurín el Grande", "Coín", "Nerja", "Torrox", "Cártama", "Churriana", "Campanillas"]);
addCities("Sevilla", ["Sevilla", "Dos Hermanas", "Alcalá de Guadaíra", "Utrera", "Mairena del Aljarafe", "Écija", "La Rinconada", "Morón de la Frontera", "Camas", "Coria del Río", "Lebrija", "Carmona", "Osuna", "Bormujos", "Tomares", "San Juan de Aznalfarache", "Castilleja de la Cuesta", "Espartinas", "Valencina de la Concepción", "Gelves", "Bollullos de la Mitación", "Montequinto"]);
// Castilla y León
addCities("Ávila", ["Ávila", "Arévalo", "Arenas de San Pedro", "Candeleda"]);
addCities("Burgos", ["Burgos", "Miranda de Ebro", "Aranda de Duero", "Briviesca", "Villarcayo", "Medina de Pomar"]);
addCities("León", ["León", "Ponferrada", "San Andrés del Rabanedo", "Villaquilambre", "La Bañeza", "Astorga", "Valencia de Don Juan", "Bembibre", "Villablino"]);
addCities("Palencia", ["Palencia", "Guardo", "Aguilar de Campoo", "Venta de Baños"]);
addCities("Salamanca", ["Salamanca", "Béjar", "Ciudad Rodrigo", "Santa Marta de Tormes", "Peñaranda de Bracamonte"]);
addCities("Segovia", ["Segovia", "Cuéllar", "El Espinar", "San Ildefonso", "La Granja de San Ildefonso"]);
addCities("Soria", ["Soria", "El Burgo de Osma", "Almazán", "San Esteban de Gormaz"]);
addCities("Valladolid", ["Valladolid", "Laguna de Duero", "Medina del Campo", "Arroyo de la Encomienda", "Zaratán", "Tordesillas", "Íscar", "Peñafiel"]);
addCities("Zamora", ["Zamora", "Benavente", "Toro", "Puebla de Sanabria"]);
// Galicia
addCities("A Coruña", ["A Coruña", "La Coruña", "Santiago de Compostela", "Ferrol", "Narón", "Oleiros", "Arteixo", "Carballo", "Culleredo", "Ribeira", "Cambre", "Betanzos", "Sada", "Ordes", "Noia", "Muros", "Cee", "Boiro", "Padrón", "Ames", "Teo", "Pontedeume", "Viveiro"]);
addCities("Lugo", ["Lugo", "Monforte de Lemos", "Viveiro", "Burela", "Vilalba", "Sarria", "Foz", "Ribadeo", "Chantada", "O Incio"]);
addCities("Ourense", ["Ourense", "Orense", "O Barco de Valdeorras", "Verín", "Xinzo de Limia", "Carballiño", "O Carballiño", "Celanova", "Ribadavia", "A Rúa"]);
addCities("Pontevedra", ["Pontevedra", "Vigo", "Vilagarcía de Arousa", "Redondela", "Marín", "Cangas", "Lalín", "Ponteareas", "Mos", "O Porriño", "Porriño", "Sanxenxo", "Tui", "Tomiño", "A Estrada", "Baiona", "Gondomar", "Moaña", "Nigrán", "Salceda de Caselas", "O Grove", "Cuntis", "Bueu", "Poio"]);
// Castilla-La Mancha
addCities("Albacete", ["Albacete", "Hellín", "Villarrobledo", "Almansa", "La Roda", "Caudete", "Tarazona de la Mancha", "Casas-Ibáñez", "Chinchilla de Monte-Aragón"]);
addCities("Ciudad Real", ["Ciudad Real", "Puertollano", "Tomelloso", "Alcázar de San Juan", "Valdepeñas", "Manzanares", "Daimiel", "La Solana", "Almadén", "Miguelturra", "Campo de Criptana", "Bolaños de Calatrava"]);
addCities("Cuenca", ["Cuenca", "Tarancón", "San Clemente", "Motilla del Palancar", "Quintanar del Rey"]);
addCities("Guadalajara", ["Guadalajara", "Azuqueca de Henares", "Alovera", "Cabanillas del Campo", "Sigüenza", "Molina de Aragón", "Marchamalo", "El Casar"]);
addCities("Toledo", ["Toledo", "Talavera de la Reina", "Illescas", "Seseña", "Torrijos", "Sonseca", "Consuegra", "Fuensalida", "Quintanar de la Orden", "Ocaña", "Mora", "Madridejos", "Yuncos", "Olías del Rey", "Villacañas"]);
// Cataluña
addCities("Barcelona", ["Barcelona", "L'Hospitalet de Llobregat", "Hospitalet de Llobregat", "Badalona", "Terrassa", "Sabadell", "Mataró", "Santa Coloma de Gramenet", "Cornellà de Llobregat", "Sant Cugat del Vallès", "Sant Boi de Llobregat", "Manresa", "Rubí", "Vilanova i la Geltrú", "Viladecans", "Castelldefels", "El Prat de Llobregat", "Granollers", "Cerdanyola del Vallès", "Mollet del Vallès", "Esplugues de Llobregat", "Sant Feliu de Llobregat", "Gavà", "Martorell", "Vic", "Igualada", "Sant Joan Despí", "Sitges", "Mataró", "Premià de Mar", "El Masnou", "Berga", "Calella", "Sant Pere de Ribes", "Sant Adrià de Besòs", "Montcada i Reixac", "Barberà del Vallès", "Ripollet", "Sant Andreu de la Barca", "Caldes de Montbui", "Olesa de Montserrat", "Blanes de Barcelona"]);
addCities("Girona", ["Girona", "Gerona", "Figueres", "Blanes", "Lloret de Mar", "Olot", "Salt", "Palafrugell", "Sant Feliu de Guíxols", "Roses", "Banyoles", "Ripoll", "Puigcerdà", "Palamós", "Santa Coloma de Farners", "La Bisbal d'Empordà"]);
addCities("Lleida", ["Lleida", "Lérida", "Balaguer", "Tàrrega", "Mollerussa", "La Seu d'Urgell", "Solsona", "Tremp", "Vielha"]);
addCities("Tarragona", ["Tarragona", "Reus", "Tortosa", "El Vendrell", "Cambrils", "Salou", "Valls", "Amposta", "Vila-seca", "Calafell", "Mora d'Ebre", "Falset", "Montblanc", "Roda de Berà"]);
// Comunidad Valenciana
addCities("Alicante", ["Alicante", "Alacant", "Elche", "Elx", "Torrevieja", "Orihuela", "Benidorm", "Alcoy", "Alcoi", "Elda", "San Vicente del Raspeig", "Denia", "Dénia", "Villena", "Petrer", "Santa Pola", "Crevillent", "Villajoyosa", "Vila Joiosa", "Ibi", "Calpe", "Jávea", "Xàbia", "Altea", "Novelda", "Pilar de la Horadada", "Cocentaina", "Sant Joan d'Alacant", "El Campello", "Muchamiel", "Pego", "Aspe", "Guardamar del Segura", "Almoradí", "Callosa de Segura", "Finestrat", "Benissa", "Ondara"]);
addCities("Castellón", ["Castellón de la Plana", "Castelló de la Plana", "Castellón", "Vila-real", "Vinaròs", "Vinaros", "Burriana", "Benicarló", "Onda", "La Vall d'Uixó", "Segorbe", "Almassora", "Benicàssim", "Peñíscola", "Morella", "Nules"]);
addCities("Valencia", ["Valencia", "València", "Torrent", "Gandia", "Gandía", "Paterna", "Sagunto", "Sagunt", "Alzira", "Mislata", "Burjassot", "Manises", "Ontinyent", "Xirivella", "Aldaia", "Cullera", "Sueca", "Requena", "Xàtiva", "Játiva", "Alaquàs", "Catarroja", "Quart de Poblet", "Llíria", "Lliria", "Godella", "Alboraya", "Albal", "Silla", "Moncada", "Carlet", "Utiel", "Algemesí", "Benifaió", "Carcaixent", "Chiva", "Alfafar", "Picassent", "Sedaví", "Massanassa", "Riba-roja de Túria", "Oliva", "Bétera", "Foios", "La Pobla de Vallbona", "Albaida"]);
// Canarias
addCities("Las Palmas", ["Las Palmas de Gran Canaria", "Las Palmas", "Telde", "Santa Lucía de Tirajana", "San Bartolomé de Tirajana", "Arucas", "Agüimes", "Ingenio", "Gáldar", "Arrecife", "Puerto del Rosario", "Maspalomas", "Playa del Inglés", "Vecindario", "Teguise", "Tías", "Yaiza", "Mogán", "Corralejo", "La Oliva", "Antigua", "Tinajo", "Haría", "San Bartolomé", "Tuineje", "Pájara", "Morro Jable", "Santa Brígida", "Teror", "Valsequillo"]);
addCities("Santa Cruz de Tenerife", ["Santa Cruz de Tenerife", "San Cristóbal de La Laguna", "La Laguna", "Arona", "Adeje", "Los Cristianos", "Costa Adeje", "Puerto de la Cruz", "Granadilla de Abona", "Candelaria", "Los Realejos", "Icod de los Vinos", "Tacoronte", "El Rosario", "Santa Cruz de La Palma", "Los Llanos de Aridane", "San Sebastián de La Gomera", "Valverde", "Guía de Isora", "La Orotava", "Güímar", "Tegueste", "Santiago del Teide", "Playa de las Américas", "Los Gigantes"]);
// Aragón
addCities("Huesca", ["Huesca", "Barbastro", "Monzón", "Fraga", "Jaca", "Sabiñánigo", "Binéfar", "Sariñena", "Graus", "Ainsa", "Aínsa"]);
addCities("Teruel", ["Teruel", "Alcañiz", "Calamocha", "Andorra", "Montalbán", "Utrillas", "Valderrobres", "Alcorisa"]);
addCities("Zaragoza", ["Zaragoza", "Calatayud", "Utebo", "Ejea de los Caballeros", "Tarazona", "Casetas", "Cuarte de Huerva", "Zuera", "Caspe", "La Almunia de Doña Godina", "Villanueva de Gállego", "Alagón", "Borja", "Tauste", "Pedrola", "Épila"]);
// Extremadura
addCities("Badajoz", ["Badajoz", "Mérida", "Don Benito", "Almendralejo", "Villanueva de la Serena", "Zafra", "Olivenza", "Montijo", "Villafranca de los Barros", "Llerena", "Castuera", "Jerez de los Caballeros", "Fuente de Cantos", "Navalmoral", "Azuaga", "Talarrubias", "Puebla de la Calzada", "Guareña"]);
addCities("Cáceres", ["Cáceres", "Plasencia", "Navalmoral de la Mata", "Coria", "Trujillo", "Miajadas", "Moraleja", "Valencia de Alcántara", "Jaraíz de la Vera", "Hervás", "Logrosán"]);
// País Vasco
addCities("Álava", ["Vitoria-Gasteiz", "Vitoria", "Gasteiz", "Llodio", "Laudio", "Amurrio", "Salvatierra", "Agurain", "Alegría-Dulantzi", "Laguardia"]);
addCities("Bizkaia", ["Bilbao", "Barakaldo", "Getxo", "Portugalete", "Santurtzi", "Basauri", "Leioa", "Galdakao", "Sestao", "Durango", "Erandio", "Mungia", "Gernika", "Gernika-Lumo", "Bermeo", "Zalla", "Sopelana", "Ermua", "Güeñes", "Zamudio", "Derio", "Berango", "Abadiño", "Muskiz", "Balmaseda", "Ondarroa", "Amorebieta", "Amorebieta-Etxano", "Etxebarri", "Bakio", "Plentzia", "Lekeitio", "Markina-Xemein", "Gorliz", "Urduliz", "Lejona", "Cruces", "Basurto", "Santa Marina", "Galdácano"]);
addCities("Gipuzkoa", ["San Sebastián", "Donostia", "Donostia-San Sebastián", "Irun", "Errenteria", "Rentería", "Eibar", "Zarautz", "Arrasate", "Mondragón", "Hernani", "Tolosa", "Hondarribia", "Fuenterrabía", "Lasarte-Oria", "Pasaia", "Beasain", "Azpeitia", "Azkoitia", "Elgoibar", "Bergara", "Oñati", "Zumarraga", "Legazpi", "Andoain", "Usurbil", "Urnieta", "Orio", "Getaria", "Deba", "Zestoa", "Villabona", "Lezo", "Oiartzun", "Ordizia", "Antzuola", "Aretxabaleta", "Elgeta", "Zumaia", "Hernani", "Soraluze", "Elgóibar"]);

/**
 * Provincia de una oferta a partir de ciudad (o código postal incrustado en ella).
 * Solo devuelve provincias de la comunidad de la oferta (evita falsos positivos
 * como Valencia/Valencia de Alcántara o Guadalajara/México).
 */
export function provinceOfJob(job: Pick<Job, "city" | "district">): string | null {
  const region = job.district;
  const list = PROVINCES_BY_REGION[region];
  if (!list) return null;
  const accept = (province: string | undefined | null) =>
    province && list.includes(province) ? province : null;

  const raw = job.city ?? "";
  // 1) Código postal incrustado ("41013 Sevilla").
  const cp = raw.match(/\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b/);
  if (cp) {
    const hit = accept(POSTAL_PREFIX[cp[1]]);
    if (hit) return hit;
  }

  const key = normalizeKey(raw.replace(/\b\d{5}\b/g, " "));
  if (!key) return null;

  // 2) Ciudad exacta.
  const exact = accept(CITY_TO_PROVINCE[key]);
  if (exact) return exact;

  // 3) "Sevilla (capital)", "Ciudad, Provincia", "Provincia - Ciudad": cada trozo.
  const parts = raw
    .split(/[,;()\-–—/|]/)
    .map((part) => normalizeKey(part.replace(/\b\d{5}\b/g, " ")))
    .filter(Boolean);
  for (const part of parts) {
    const byCity = accept(CITY_TO_PROVINCE[part]);
    if (byCity) return byCity;
    const byName = accept(PROVINCE_ALIASES[part]);
    if (byName) return byName;
  }

  // 4) Nombre de provincia como palabra completa dentro del texto.
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

/** Igual que provinceOfJob, memoizado por objeto (las listas se filtran muchas veces). */
export function jobProvince(job: Job): string | null {
  const cached = provinceCache.get(job);
  if (cached !== undefined) return cached;
  const value = provinceOfJob(job);
  provinceCache.set(job, value);
  return value;
}
