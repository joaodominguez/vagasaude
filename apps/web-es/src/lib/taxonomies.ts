import { regions as spainRegions } from "@/lib/spain-map";

/**
 * Áreas de salud del producto (España) — clínicas + ecosistema.
 * Orden: volumen clínico habitual primero; luego áreas adyacentes.
 *
 * - "TCAE" = Técnico/a en Cuidados Auxiliares de Enfermería (la búsqueda
 *   "empleo TCAE" tiene mucho volumen; por eso el label es la sigla).
 * - "Técnico sanitario" agrupa Técnicos Superiores (radiología, laboratorio,
 *   anatomía patológica, dietética, audioprótesis…) y Técnicos (emergencias
 *   sanitarias, imagen para el diagnóstico…), más terapia ocupacional y
 *   logopedia hasta que haya volumen para landings propias.
 * - "Celador" = personal de servicios (camillero/celador) en hospitales.
 *
 * ATENCIÓN: estos labels deben coincidir con los que devuelve
 * `guess_profession` en scrapers-es/common/normalize.py.
 */
export const professions = [
  "Enfermería",
  "Medicina",
  "TCAE",
  "Fisioterapia",
  "Técnico sanitario",
  "Farmacia",
  "Técnico de farmacia",
  "Celador",
  "Psicología",
  "Nutrición",
  "Odontología",
  "Óptica y audiología",
  "Veterinaria",
  "Trabajo social",
  "Formación",
  "Comercial / Farma",
  "Gestión y apoyo",
  "Administrativo",
] as const;

/** "Concertado" = entidades sin ánimo de lucro / concertadas con el SNS (Cruz Roja, San Juan de Dios…). */
export const sectors = ["Público", "Privado", "Concertado"] as const;

/**
 * Comunidades autónomas + ciudades autónomas. El campo interno se sigue
 * llamando `district` (contrato con los scrapers: `location_district`).
 * Ver docs/es/plan-lanzamiento-es.md para la recomendación comunidad vs provincia.
 */
export const districts = [...spainRegions] as const;
