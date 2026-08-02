import { districts as mainlandDistricts } from "@/lib/portugal-map";

export const professions = [
  "Enfermagem",
  "Medicina",
  "Fisioterapia",
  "Auxiliares",
  "Técnico de Saúde",
  "Farmácia",
] as const;

export const sectors = ["Público", "Privado", "IPSS"] as const;

/** Continente + regiões autónomas (para filtros e landings). */
export const districts = [...mainlandDistricts, "Açores", "Madeira"] as const;
