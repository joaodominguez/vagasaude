/**
 * Mapa de la home: cartograma de teselas (tile grid map) de las comunidades
 * autónomas. No usa geometría real (no hay GeoJSON simplificado en el repo);
 * cada comunidad es un marcador colocado en una rejilla que respeta la
 * disposición aproximada de la península (+ Baleares, Canarias, Ceuta, Melilla).
 * viewBox: 0 0 250 200
 */
export const SPAIN_REGIONS = [
  { name: "Galicia", code: "GAL", col: 0, row: 0 },
  { name: "Asturias", code: "AST", col: 1, row: 0 },
  { name: "Cantabria", code: "CAN", col: 2, row: 0 },
  { name: "País Vasco", code: "PV", col: 3, row: 0 },
  { name: "Navarra", code: "NAV", col: 4, row: 0 },
  { name: "Castilla y León", code: "CYL", col: 1, row: 1 },
  { name: "La Rioja", code: "RIO", col: 3, row: 1 },
  { name: "Aragón", code: "ARA", col: 4, row: 1 },
  { name: "Cataluña", code: "CAT", col: 5, row: 1 },
  { name: "Extremadura", code: "EXT", col: 1, row: 2 },
  { name: "Madrid", code: "MAD", col: 2, row: 2 },
  { name: "Castilla-La Mancha", code: "CLM", col: 3, row: 2 },
  { name: "Comunidad Valenciana", code: "VAL", col: 4, row: 2 },
  { name: "Islas Baleares", code: "BAL", col: 6, row: 2 },
  { name: "Andalucía", code: "AND", col: 2, row: 3 },
  { name: "Murcia", code: "MUR", col: 4, row: 3 },
  { name: "Canarias", code: "CNR", col: 0, row: 3 },
  { name: "Ceuta", code: "CEU", col: 1, row: 4 },
  { name: "Melilla", code: "MEL", col: 3, row: 4 },
] as const;

export const SPAIN_MAP_VIEWBOX = "0 0 250 200";
const CELL_X = 34;
const CELL_Y = 36;
const ORIGIN = 20;

export function regionCenter(region: { col: number; row: number }) {
  return { x: ORIGIN + region.col * CELL_X, y: ORIGIN + region.row * CELL_Y };
}

export type SpainRegionName = (typeof SPAIN_REGIONS)[number]["name"];

export const regions = SPAIN_REGIONS.map((region) => region.name);
