export type JobSourceMeta = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  sector: "Público" | "Privado" | "Filantrópico";
  logo: string;
};

/**
 * Fontes BR activas (scrapers-br/). Logos na home — grelha igual ao PT.
 */
export const JOB_SOURCES: JobSourceMeta[] = [
  {
    id: "pci_concursos",
    name: "PCI Concursos — Saúde",
    shortName: "PCI Concursos",
    url: "https://www.pciconcursos.com.br/vagas/saude/",
    sector: "Público",
    logo: "/partners/pci-concursos.svg",
  },
  {
    id: "agsus",
    name: "AgSUS — Agência Brasileira de Apoio à Gestão do SUS",
    shortName: "AgSUS",
    url: "https://agenciasus.org.br/trabalheconosco/",
    sector: "Público",
    logo: "/partners/agsus.svg",
  },
  {
    id: "inca",
    name: "INCA — Instituto Nacional de Câncer",
    shortName: "INCA",
    url: "https://www.gov.br/inca/pt-br/acesso-a-informacao/institucional/concurso-publico",
    sector: "Público",
    logo: "/partners/inca.svg",
  },
  {
    id: "rededor",
    name: "Rede D'Or São Luiz",
    shortName: "Rede D'Or",
    url: "https://rededor.gupy.io/",
    sector: "Privado",
    logo: "/partners/rededor.png",
  },
  {
    id: "hapvida",
    name: "Hapvida NotreDame Intermédica",
    shortName: "Hapvida",
    url: "https://hapvidandi.gupy.io/",
    sector: "Privado",
    logo: "/partners/hapvida.png",
  },
  {
    id: "irssl",
    name: "IRSSL — Instituto de Responsabilidade Social Sírio-Libanês",
    shortName: "IRSSL",
    url: "https://irssl.gupy.io/",
    sector: "Público",
    logo: "/partners/irssl.png",
  },
  {
    id: "hsl_sirio",
    name: "Hospital Sírio-Libanês",
    shortName: "Sírio-Libanês",
    url: "https://vagas.hsl.org.br/",
    sector: "Privado",
    logo: "/partners/hsl-sirio.svg",
  },
  {
    id: "santa_casa_bh",
    name: "Santa Casa de Misericórdia de Belo Horizonte",
    shortName: "Santa Casa BH",
    url: "https://santacasabh.gupy.io/",
    sector: "Filantrópico",
    logo: "/partners/santa-casa-bh.png",
  },
  {
    id: "santa_casa_poa",
    name: "Santa Casa de Misericórdia de Porto Alegre",
    shortName: "Santa Casa POA",
    url: "https://santacasa.gupy.io/",
    sector: "Filantrópico",
    logo: "/partners/santa-casa-poa.svg",
  },
  {
    id: "santa_casa_ba",
    name: "Santa Casa da Bahia",
    shortName: "Santa Casa BA",
    url: "https://santacasaba.gupy.io/",
    sector: "Filantrópico",
    logo: "/partners/santa-casa-ba.svg",
  },
  {
    id: "aacd",
    name: "AACD — Associação de Assistência à Criança Deficiente",
    shortName: "AACD",
    url: "https://aacd.gupy.io/",
    sector: "Filantrópico",
    logo: "/partners/aacd.svg",
  },
  {
    id: "redeamericas",
    name: "Rede Américas (Ímpar)",
    shortName: "Rede Américas",
    url: "https://redeamericas.gupy.io/",
    sector: "Privado",
    logo: "/partners/redeamericas.png",
  },
  {
    id: "moinhos",
    name: "Hospital Moinhos de Vento",
    shortName: "Moinhos",
    url: "https://hospitalmoinhos.gupy.io/",
    sector: "Privado",
    logo: "/partners/moinhos.png",
  },
  {
    id: "bp",
    name: "BP — Beneficência Portuguesa de São Paulo",
    shortName: "BP",
    url: "https://vemserbp.gupy.io/",
    sector: "Privado",
    logo: "/partners/bp.png",
  },
  {
    id: "einstein",
    name: "Hospital Israelita Albert Einstein",
    shortName: "Einstein",
    url: "https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades",
    sector: "Privado",
    logo: "/partners/einstein.png",
  },
  {
    id: "haoc",
    name: "Hospital Alemão Oswaldo Cruz",
    shortName: "Oswaldo Cruz",
    url: "https://www.hospitaloswaldocruz.org.br/trabalhe-conosco/",
    sector: "Privado",
    logo: "/partners/haoc.svg",
  },
  {
    id: "hcor",
    name: "HCor — Hospital do Coração",
    shortName: "HCor",
    url: "https://hcoracao.pandape.infojobs.com.br/",
    sector: "Filantrópico",
    logo: "/partners/hcor.svg",
  },
  {
    id: "mater_dei",
    name: "Rede Mater Dei de Saúde",
    shortName: "Mater Dei",
    url: "https://app.jobconvo.com/pt-br/careers/hospital-mater-dei/6fcf22e3-009f-40e9-94ea-25e36ed95d22/",
    sector: "Privado",
    logo: "/partners/mater-dei.svg",
  },
];

export function getSourceMeta(id: string) {
  return JOB_SOURCES.find((source) => source.id === id) ?? null;
}

export const SOURCE_META = Object.fromEntries(
  JOB_SOURCES.map((source) => [
    source.id,
    { name: source.name, url: source.url, sector: source.sector },
  ]),
) as Record<string, { name: string; url: string; sector: string }>;
