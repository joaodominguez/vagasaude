/** Approximate marker positions on a stylised mainland Portugal map (viewBox 0 0 200 340). */
export const PORTUGAL_DISTRICTS = [
  { name: "Viana do Castelo", x: 70, y: 34 },
  { name: "Braga", x: 82, y: 52 },
  { name: "Vila Real", x: 112, y: 56 },
  { name: "Bragança", x: 148, y: 48 },
  { name: "Porto", x: 78, y: 78 },
  { name: "Aveiro", x: 74, y: 104 },
  { name: "Viseu", x: 108, y: 108 },
  { name: "Guarda", x: 142, y: 112 },
  { name: "Coimbra", x: 92, y: 132 },
  { name: "Castelo Branco", x: 136, y: 150 },
  { name: "Leiria", x: 72, y: 152 },
  { name: "Santarém", x: 92, y: 178 },
  { name: "Portalegre", x: 138, y: 182 },
  { name: "Lisboa", x: 68, y: 208 },
  { name: "Setúbal", x: 82, y: 230 },
  { name: "Évora", x: 118, y: 224 },
  { name: "Beja", x: 112, y: 258 },
  { name: "Faro", x: 98, y: 298 },
] as const;

export type PortugalDistrictName = (typeof PORTUGAL_DISTRICTS)[number]["name"];

export const districts = PORTUGAL_DISTRICTS.map((district) => district.name);

/** Simplified mainland silhouette for atmosphere (not cadastral accuracy). */
export const PORTUGAL_OUTLINE =
  "M86 22 C74 26 66 36 64 48 C60 66 68 78 72 92 C70 108 64 122 66 138 C68 158 60 176 56 196 C54 214 60 228 70 238 C66 252 72 268 84 282 C94 298 102 314 118 320 C130 316 134 300 130 286 C138 274 144 258 142 242 C152 228 156 210 152 192 C158 172 154 152 148 136 C156 118 154 98 146 82 C152 64 144 44 128 34 C112 26 98 20 86 22 Z";
