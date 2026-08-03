import { districts as mainlandDistricts } from "@/lib/portugal-map";

/**
 * Áreas de saúde no produto — clínicas + ecossistema (formação, farma, suporte).
 * Ordem: volume clínico habitual primeiro; depois áreas adjacentes.
 */
export const professions = [
  "Enfermagem",
  "Medicina",
  "Fisioterapia",
  "Auxiliares",
  "Técnico de Saúde",
  "Farmácia",
  "Psicologia",
  "Nutrição",
  "Assistência Social",
  "Formação",
  "Comercial / Farma",
  "Gestão & suporte",
  "Administrativo",
] as const;

export const sectors = ["Público", "Privado", "IPSS"] as const;

/** Continente + regiões autónomas (para filtros e landings). */
export const districts = [...mainlandDistricts, "Açores", "Madeira"] as const;
