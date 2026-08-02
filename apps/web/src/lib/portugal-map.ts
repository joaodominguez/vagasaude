/**
 * District markers and mainland silhouette for the homepage map.
 * Outline derived from simplified official district boundaries.
 * viewBox: 0 0 240 390
 */
export const PORTUGAL_DISTRICTS = [
  { name: "Viana do Castelo", x: 77.5, y: 41.5 },
  { name: "Braga", x: 89.5, y: 64.3 },
  { name: "Vila Real", x: 125.9, y: 80.6 },
  { name: "Bragança", x: 177.6, y: 48.0 },
  { name: "Porto", x: 79.1, y: 90.3 },
  { name: "Aveiro", x: 77.0, y: 123.5 },
  { name: "Viseu", x: 117.2, y: 122.2 },
  { name: "Guarda", x: 152.1, y: 130.1 },
  { name: "Coimbra", x: 90.0, y: 152.2 },
  { name: "Castelo Branco", x: 140.1, y: 176.9 },
  { name: "Leiria", x: 68.8, y: 182.1 },
  { name: "Santarém", x: 75.3, y: 214.7 },
  { name: "Portalegre", x: 143.4, y: 211.4 },
  { name: "Lisboa", x: 50.3, y: 248.5 },
  { name: "Setúbal", x: 63.9, y: 261.5 },
  { name: "Évora", x: 117.2, y: 258.3 },
  { name: "Beja", x: 120.0, y: 298.7 },
  { name: "Faro", x: 116.1, y: 350.7 },
] as const;

export type PortugalDistrictName = (typeof PORTUGAL_DISTRICTS)[number]["name"];

export const districts = PORTUGAL_DISTRICTS.map((district) => district.name);

/** Simplified mainland Portugal silhouette (from district GeoJSON). */
export const PORTUGAL_OUTLINE =
  "M 30.7 244.7 L 39.3 215.7 L 35.7 206.8 L 53.1 192.7 L 76.3 105.5 L 64.4 51.1 L 67.7 40.9 L 101.5 25.0 L 107.7 31.9 L 101.4 40.0 L 105.5 47.2 L 117.4 39.8 L 144.5 45.6 L 159.1 35.6 L 189.2 37.1 L 192.3 56.0 L 210.3 61.5 L 203.9 75.0 L 173.4 99.8 L 178.7 141.5 L 165.9 151.5 L 174.2 164.4 L 165.9 186.7 L 139.2 189.1 L 150.7 200.6 L 154.1 217.0 L 169.4 228.8 L 152.3 250.0 L 151.9 269.6 L 161.5 283.0 L 170.5 281.8 L 166.6 293.9 L 154.0 296.5 L 139.7 322.0 L 145.3 349.7 L 118.5 363.1 L 79.8 352.5 L 58.1 359.0 L 68.8 331.3 L 68.9 302.6 L 63.9 298.7 L 69.5 273.5 L 62.3 263.8 L 45.8 268.5 L 45.8 254.9 Z";
