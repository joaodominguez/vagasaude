/**
 * Preposizioni locative per regioni e province: "in Lombardia", "nel Lazio",
 * "nelle Marche", "in provincia di Milano". "in" e' il default (regioni senza
 * articolo); le poche eccezioni con articolo sono elencate qui.
 */
const NEL = new Set(["Lazio", "Molise"]);
const NELLE = new Set(["Marche"]);

export function inRegione(place: string) {
  if (NEL.has(place)) return `nel ${place}`;
  if (NELLE.has(place)) return `nelle ${place}`;
  return `in ${place}`;
}

export function inProvincia(province: string) {
  return `in provincia di ${province}`;
}
