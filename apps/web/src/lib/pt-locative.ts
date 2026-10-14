const NO = new Set([
  "porto",
  "funchal",
  "seixal",
  "barreiro",
  "montijo",
  "cartaxo",
  "entroncamento",
  "fundao",
  "bombarral",
  "sabugal",
  "crato",
  "marco de canaveses",
  "peso da regua",
  "porto santo",
]);

const NA = new Set([
  "madeira",
  "guarda",
  "maia",
  "trofa",
  "amadora",
  "covilha",
  "figueira da foz",
  "povoa de varzim",
  "povoa de lanhoso",
  "nazare",
  "lourinha",
  "golega",
  "batalha",
  "ribeira grande",
  "ribeira brava",
  "calheta",
  "chamusca",
  "mealhada",
  "murtosa",
  "pampilhosa da serra",
  "praia da vitoria",
  "horta",
  "lagoa",
  "serta",
]);

const NOS = new Set(["acores", "arcos de valdevez"]);

function key(place: string) {
  return place
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** "no Porto", "na Guarda", "nos Açores", "em Lisboa". */
export function emLocal(place: string) {
  const k = key(place);
  if (NO.has(k)) return `no ${place}`;
  if (NA.has(k)) return `na ${place}`;
  if (NOS.has(k)) return `nos ${place}`;
  return `em ${place}`;
}
