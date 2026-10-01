export type Job = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Público" | "Privado" | "Filantrópico";
  contract: string;
  profession: string;
  publishedLabel: string;
  publishedAt: string;
  expiresAt?: string | null;
  description: string;
  requirements: string[];
  responsibilities: string[];
  applicationUrl: string;
  /** Remuneração anunciada na fonte (se existir). */
  salary?: string | null;
  featured?: boolean;
};

/**
 * Seeds de demonstração (Brasil). Em produção as vagas vêm do job-store
 * alimentado pelos scrapers em scrapers-br/.
 */
export const jobs: Job[] = [
  {
    slug: "enfermeiro-uti-hospital-exemplo-sao-paulo",
    title: "Enfermeiro(a) — UTI adulto",
    company: "Hospital Exemplo São Paulo",
    district: "São Paulo",
    city: "São Paulo",
    sector: "Privado",
    contract: "CLT",
    profession: "Enfermagem",
    publishedLabel: "Hoje",
    publishedAt: "2026-10-01",
    description:
      "Hospital de referência em São Paulo procura enfermeiro(a) para UTI adulto. Vaga de demonstração do VagaSaúde Brasil — substituir pelas fontes reais.",
    requirements: [
      "COREN activo",
      "Experiência em UTI (preferencial)",
      "Disponibilidade para plantões",
    ],
    responsibilities: [
      "Prestação de cuidados de enfermagem em UTI",
      "Registo e monitorização de utentes",
      "Trabalho em equipa multidisciplinar",
    ],
    applicationUrl: "https://vagasaude.com.br/",
    featured: true,
  },
  {
    slug: "fisioterapeuta-ambulatorio-rio-de-janeiro",
    title: "Fisioterapeuta — Ambulatório",
    company: "Clínica Exemplo Rio",
    district: "Rio de Janeiro",
    city: "Rio de Janeiro",
    sector: "Privado",
    contract: "CLT",
    profession: "Fisioterapia",
    publishedLabel: "Ontem",
    publishedAt: "2026-09-30",
    description:
      "Clínica no Rio de Janeiro procura fisioterapeuta para ambulatório. Vaga de demonstração do VagaSaúde Brasil.",
    requirements: ["CREFITO activo", "Experiência clínica"],
    responsibilities: [
      "Atendimento ambulatorial",
      "Elaboração de planos terapêuticos",
    ],
    applicationUrl: "https://vagasaude.com.br/",
  },
  {
    slug: "medico-clinico-geral-sus-belo-horizonte",
    title: "Médico(a) clínico geral — UBS",
    company: "Rede SUS Exemplo",
    district: "Minas Gerais",
    city: "Belo Horizonte",
    sector: "Público",
    contract: "Contrato",
    profession: "Medicina",
    publishedLabel: "Há 2 dias",
    publishedAt: "2026-09-29",
    description:
      "Unidade básica de saúde em Belo Horizonte. Vaga de demonstração do VagaSaúde Brasil.",
    requirements: ["CRM activo", "Residência ou experiência em clínica geral"],
    responsibilities: ["Atendimento em UBS", "Acompanhamento de utentes"],
    applicationUrl: "https://vagasaude.com.br/",
  },
];

export { districts, professions } from "@/lib/taxonomies";

export function getJob(slug: string) {
  return jobs.find((job) => job.slug === slug);
}
