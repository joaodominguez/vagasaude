export type Job = {
  slug: string;
  title: string;
  company: string;
  district: string;
  city: string;
  sector: "Público" | "Privado" | "IPSS";
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

export const jobs: Job[] = [
  {
    slug: "enfermeiro-servico-urgencia-hospital-luz-lisboa",
    title: "Enfermeiro/a — Serviço de Urgência",
    company: "Hospital da Luz Lisboa",
    district: "Lisboa",
    city: "Lisboa",
    sector: "Privado",
    contract: "Tempo inteiro",
    profession: "Enfermagem",
    publishedLabel: "Hoje",
    publishedAt: "2026-08-02",
    description:
      "O Hospital da Luz Lisboa procura um/a Enfermeiro/a para integrar a equipa do Serviço de Urgência, assegurando cuidados de enfermagem de excelência e promovendo o bem-estar e a segurança dos utentes.",
    requirements: [
      "Licenciatura em Enfermagem e cédula profissional válida.",
      "Experiência em contexto de urgência (preferencial).",
      "Capacidade de trabalho em equipa e boa gestão do stress.",
      "Sentido de responsabilidade, empatia e orientação para o utente.",
      "Disponibilidade para horários rotativos.",
    ],
    responsibilities: [
      "Prestar cuidados de enfermagem diferenciados e de qualidade.",
      "Avaliar e monitorizar o estado clínico dos utentes.",
      "Administrar terapêutica e realizar procedimentos de enfermagem.",
      "Colaborar com a equipa multidisciplinar na definição de planos de cuidados.",
      "Garantir o registo rigoroso das intervenções no processo clínico.",
    ],
    applicationUrl: "https://www.hospitaldaluz.pt/",
    featured: true,
  },
  {
    slug: "medico-medicina-geral-unidade-local-saude-porto",
    title: "Médico/a de Medicina Geral",
    company: "Unidade Local de Saúde",
    district: "Porto",
    city: "Porto",
    sector: "Público",
    contract: "Contrato",
    profession: "Medicina",
    publishedLabel: "Hoje",
    publishedAt: "2026-08-02",
    description:
      "Recrutamento de médico/a para integrar uma equipa de cuidados de saúde primários, com foco na proximidade, prevenção e acompanhamento continuado.",
    requirements: [
      "Licenciatura ou mestrado integrado em Medicina.",
      "Inscrição válida na Ordem dos Médicos.",
      "Especialidade em Medicina Geral e Familiar.",
    ],
    responsibilities: [
      "Prestar cuidados médicos personalizados.",
      "Acompanhar doentes e respetivas famílias.",
      "Participar em programas de prevenção e promoção da saúde.",
    ],
    applicationUrl: "https://www.bep.gov.pt/",
    featured: true,
  },
  {
    slug: "fisioterapeuta-clinica-reabilitacao-braga",
    title: "Fisioterapeuta",
    company: "Clínica de Reabilitação do Minho",
    district: "Braga",
    city: "Braga",
    sector: "Privado",
    contract: "Tempo inteiro",
    profession: "Fisioterapia",
    publishedLabel: "Ontem",
    publishedAt: "2026-08-01",
    description:
      "Procuramos fisioterapeuta para avaliação e acompanhamento de utentes em contexto ambulatório, numa equipa clínica multidisciplinar.",
    requirements: [
      "Licenciatura em Fisioterapia.",
      "Cédula profissional válida.",
      "Boa capacidade de comunicação.",
    ],
    responsibilities: [
      "Avaliar a condição funcional dos utentes.",
      "Definir e executar planos terapêuticos.",
      "Registar a evolução clínica.",
    ],
    applicationUrl: "https://example.com/candidatura",
  },
  {
    slug: "auxiliar-acao-medica-hospital-cascais",
    title: "Auxiliar de Ação Médica",
    company: "Hospital de Cascais",
    district: "Lisboa",
    city: "Cascais",
    sector: "Privado",
    contract: "Turnos",
    profession: "Auxiliares",
    publishedLabel: "Há 2 dias",
    publishedAt: "2026-07-31",
    description:
      "Vaga para auxiliar de ação médica com disponibilidade para turnos e forte orientação para o cuidado ao utente.",
    requirements: [
      "Formação de auxiliar de saúde (preferencial).",
      "Disponibilidade para turnos.",
      "Espírito de equipa.",
    ],
    responsibilities: [
      "Apoiar a equipa de enfermagem.",
      "Assegurar o conforto e transporte dos utentes.",
      "Cumprir os procedimentos de higiene e segurança.",
    ],
    applicationUrl: "https://example.com/candidatura",
  },
  {
    slug: "tecnico-analises-clinicas-coimbra",
    title: "Técnico/a de Análises Clínicas",
    company: "Centro Hospitalar de Coimbra",
    district: "Coimbra",
    city: "Coimbra",
    sector: "Público",
    contract: "Contrato a termo",
    profession: "Técnico de Saúde",
    publishedLabel: "Há 3 dias",
    publishedAt: "2026-07-30",
    description:
      "Oportunidade para técnico/a de análises clínicas integrar laboratório hospitalar com atividade multidisciplinar.",
    requirements: [
      "Licenciatura adequada à função.",
      "Cédula profissional válida.",
      "Rigor técnico e organização.",
    ],
    responsibilities: [
      "Preparar e processar amostras.",
      "Validar procedimentos laboratoriais.",
      "Cumprir as normas de qualidade.",
    ],
    applicationUrl: "https://www.bep.gov.pt/",
  },
  {
    slug: "farmaceutico-hospitalar-faro",
    title: "Farmacêutico/a Hospitalar",
    company: "Hospital Particular do Algarve",
    district: "Faro",
    city: "Faro",
    sector: "Privado",
    contract: "Tempo inteiro",
    profession: "Farmácia",
    publishedLabel: "Há 4 dias",
    publishedAt: "2026-07-29",
    description:
      "Recrutamento de farmacêutico/a para os serviços farmacêuticos de unidade hospitalar privada.",
    requirements: [
      "Mestrado integrado em Ciências Farmacêuticas.",
      "Inscrição na Ordem dos Farmacêuticos.",
      "Experiência hospitalar valorizada.",
    ],
    responsibilities: [
      "Gerir e dispensar medicamentos.",
      "Apoiar a equipa clínica.",
      "Assegurar o cumprimento das normas aplicáveis.",
    ],
    applicationUrl: "https://example.com/candidatura",
  },
];

export { districts, professions } from "@/lib/taxonomies";

export function getJob(slug: string) {
  return jobs.find((job) => job.slug === slug);
}
