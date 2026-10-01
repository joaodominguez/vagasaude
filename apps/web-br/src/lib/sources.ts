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
    id: "rededor",
    name: "Rede D'Or São Luiz",
    shortName: "Rede D'Or",
    url: "https://rededor.gupy.io/",
    sector: "Privado",
    logo: "/partners/rededor.svg",
  },
  {
    id: "hapvida",
    name: "Hapvida NotreDame Intermédica",
    shortName: "Hapvida",
    url: "https://hapvidandi.gupy.io/",
    sector: "Privado",
    logo: "/partners/hapvida.svg",
  },
  {
    id: "irssl",
    name: "IRSSL — Instituto de Responsabilidade Social Sírio-Libanês",
    shortName: "IRSSL",
    url: "https://irssl.gupy.io/",
    sector: "Público",
    logo: "/partners/irssl.svg",
  },
  {
    id: "santa_casa_bh",
    name: "Santa Casa de Misericórdia de Belo Horizonte",
    shortName: "Santa Casa BH",
    url: "https://santacasabh.gupy.io/",
    sector: "Filantrópico",
    logo: "/partners/santa-casa-bh.svg",
  },
  {
    id: "redeamericas",
    name: "Rede Américas (Ímpar)",
    shortName: "Rede Américas",
    url: "https://redeamericas.gupy.io/",
    sector: "Privado",
    logo: "/partners/redeamericas.svg",
  },
  {
    id: "moinhos",
    name: "Hospital Moinhos de Vento",
    shortName: "Moinhos",
    url: "https://hospitalmoinhos.gupy.io/",
    sector: "Privado",
    logo: "/partners/moinhos.svg",
  },
  {
    id: "bp",
    name: "BP — Beneficência Portuguesa de São Paulo",
    shortName: "BP",
    url: "https://vemserbp.gupy.io/",
    sector: "Privado",
    logo: "/partners/bp.svg",
  },
  {
    id: "einstein",
    name: "Hospital Israelita Albert Einstein",
    shortName: "Einstein",
    url: "https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades",
    sector: "Privado",
    logo: "/partners/einstein.svg",
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
