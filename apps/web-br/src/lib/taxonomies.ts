import { brazilStateNames } from "@/lib/brazil-states";

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

/** Público (SUS), privado e filantrópico. */
export const sectors = ["Público", "Privado", "Filantrópico"] as const;

/** Estados brasileiros para filtros e landings. */
export const districts = brazilStateNames;
