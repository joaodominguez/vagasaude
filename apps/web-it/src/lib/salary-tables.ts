/**
 * Dataset delle retribuzioni di riferimento per professione (Italia).
 *
 * NON INVENTIAMO CIFRE. Una voce può essere aggiunta solo
 * con una fonte pubblica primaria citata nella riga stessa (es. tabelle
 * retributive del CCNL Comparto Sanità, CCNL Dirigenza Medica e Sanitaria,
 * CCNL RSA/Sanità privata AIOP-ARIS), con anno e URL. Finché `CAREERS` è vuoto
 * le sezioni sugli stipendi sono nascoste (link, home, sitemap) e le pagine
 * /stipendi mostrano solo un avviso "in preparazione" con noindex.
 *
 * (Il simulatore di stipendio netto spagnolo, con IRPF e Seguridad Social,
 * è stato rimosso: non ha equivalente validato per l'Italia.)
 */

export const SALARY_YEAR = new Date().getFullYear();

export type SalarySource = { label: string; url: string };

export type PayRow = {
  /** Contratto / ente / tabella di riferimento (es. "CCNL Comparto Sanità, area degli operatori"). */
  service: string;
  year: number;
  /** Retribuzione lorda annua in euro (tutte le mensilità incluse). */
  annual: number;
  note?: string;
  source: SalarySource;
  /**
   * "base" (default) = stipendio tabellare; "component" = componente fissa
   * definita dal CCNL, mostrata a parte (non entra nei riepiloghi);
   * "total" = somma esplicita delle componenti fisse minime a inizio carriera.
   */
  kind?: "base" | "component" | "total";
};

export type PayTable = { name: string; rows: PayRow[] };

export type Career = {
  slug: string;
  /** Nome della professione, minuscolo, per le frasi (es. "infermiere"). */
  label: string;
  /** Nome con articolo indeterminativo per le frasi (es. "un infermiere", "un'ostetrica"). */
  indefinite: string;
  /** Etichetta di categoria in lib/taxonomies.ts. */
  profession: string;
  intro: string;
  tables: PayTable[];
  /** Cosa non è incluso negli importi (per note e FAQ). */
  excludes: string;
  /** Riferimento SSN mostrato nella scheda di un'offerta. */
  ssn: {
    /** Con articolo: "un infermiere", "un dirigente medico". */
    role: string;
    /** Nome breve del contratto: "CCNL Comparto Sanità 2022-2024". */
    contract: string;
  };
};

const ARAN_COMPARTO_SANITA_2022_2024: SalarySource = {
  label: "ARAN, CCNL Comparto Sanità 2022-2024 (sottoscritto il 27/10/2025), Tabelle 2a e Allegato A",
  url: "https://www.aranagenzia.it/wp-content/uploads/2025/10/2025.10.27-CCNL-comparto-definitivo-3.pdf",
};

const ARAN_AREA_SANITA_2022_2024: SalarySource = {
  label: "ARAN, CCNL Area Sanità 2022-2024 (sottoscritto il 27/02/2026), artt. 11, 14 e 15",
  url: "https://www.aranagenzia.it/wp-content/uploads/2026/02/2026.02.27-CCNL-Area-sanita-2022-2024-3.pdf",
};

const GU_AREA_SANITA_2019_2021: SalarySource = {
  label: "Gazzetta Ufficiale n. 59 dell'11/3/2024, CCNL Area Sanità 2019-2021 (23/1/2024), art. 64",
  url: "https://www.gazzettaufficiale.it/eli/gu/2024/03/11/59/sg/pdf",
};

/** Tabella 2a/2b del Comparto: importo annuo su 12 mensilità, a cui si aggiunge la 13ª (÷ 12 × 13). */
const with13th = (annual12: number) => Math.round(((annual12 * 13) / 12) * 100) / 100;

const COMPARTO_YEAR = 2024;
const COMPARTO_BASE_NOTE = (area: string, val: string) =>
  `Tabella 2a (PDF p. 107), ${area}, dal 1/1/2024: ${val} € su 12 mensilità più tredicesima (${val} ÷ 12 × 13)`;

function comparto(args: {
  slug: string;
  label: string;
  indefinite: string;
  profession: string;
  ssnRole: string;
  profili: string;
  area: "professionisti" | "operatori";
}): Career {
  const professionisti = args.area === "professionisti";
  const value = professionisti ? 24918.93 : 21545.34;
  const valueText = professionisti ? "24.918,93" : "21.545,34";
  const areaName = professionisti
    ? "Area dei professionisti della salute e dei funzionari"
    : "Area degli operatori";
  return {
    slug: args.slug,
    label: args.label,
    indefinite: args.indefinite,
    profession: args.profession,
    excludes: "anzianità, indennità e turni",
    ssn: { role: args.ssnRole, contract: "CCNL Comparto Sanità 2022-2024" },
    intro: `Nel pubblico (aziende sanitarie e ospedaliere) ${args.profili} rientra nell'${areaName} del CCNL Comparto Sanità 2022-2024 (Allegato A, declaratoria delle aree e dei profili). La retribuzione tabellare è lorda e indicata per 12 mensilità più la tredicesima, a cui si aggiungono anzianità e indennità. Nel privato, nell'accreditato e nelle RSA si applicano altri contratti (per esempio AIOP o ARIS), con importi diversi.`,
    tables: [
      {
        name: "Settore pubblico: CCNL Comparto Sanità 2022-2024",
        rows: [
          {
            service: `CCNL Comparto Sanità, ${areaName}`,
            year: COMPARTO_YEAR,
            annual: with13th(value),
            note: COMPARTO_BASE_NOTE(areaName, valueText),
            source: ARAN_COMPARTO_SANITA_2022_2024,
          },
        ],
      },
    ],
  };
}

type DirigenzaKind = "medica" | "sanitaria";

/**
 * Dirigenza Area Sanità. Valori di CCNL (tutti lordi annui, tredicesima inclusa):
 * - stipendio tabellare 50.005,77 (CCNL 2022-2024 art. 11, dal 1/1/2024), uguale per tutti i dirigenti dell'area;
 * - indennità di esclusività (CCNL 23/1/2024 art. 64 c. 3, dal 1/1/2021): fasce per anzianità e tipo di incarico;
 * - indennità di specificità (CCNL 2022-2024 art. 15, dal 31/12/2024): 9.466,00 medico-veterinaria, 1.614,46 sanitaria;
 * - retribuzione di posizione parte fissa, incarico professionale iniziale (CCNL 2022-2024 art. 14 c. 3): 2.511,00.
 */
function dirigenza(args: {
  slug: string;
  label: string;
  indefinite: string;
  profession: string;
  kind: DirigenzaKind;
  qualifica: string;
  intro: string;
}): Career {
  const medica = args.kind === "medica";
  const tabellare = 50005.77;
  const escl = medica
    ? { fino5: 3199.37, da5a15: 12913.35, oltre15: 17599.13, struttura: 23461.08 }
    : { fino5: 2169.22, da5a15: 7346.16, oltre15: 17095.93, struttura: 23461.08 };
  const spec = medica ? 9466.0 : 1614.46;
  const posizione = 2511.0;
  const total = Math.round((tabellare + escl.fino5 + spec + posizione) * 100) / 100;
  const specLabel = medica
    ? "indennità di specificità medico-veterinaria"
    : "indennità di specificità sanitaria";
  const cents = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2 });
  return {
    slug: args.slug,
    label: args.label,
    indefinite: args.indefinite,
    profession: args.profession,
    excludes:
      "retribuzione di posizione variabile e di risultato, indennità di struttura complessa, guardie, straordinari e compensi per condizioni di lavoro",
    ssn: {
      role: args.qualifica,
      contract: "CCNL Area Sanità 2022-2024",
    },
    intro: args.intro,
    tables: [
      {
        name: "Stipendio tabellare: CCNL Area Sanità 2022-2024",
        rows: [
          {
            service: "CCNL Area Sanità, stipendio tabellare dei dirigenti",
            year: 2024,
            annual: tabellare,
            note: "art. 11 (PDF p. 17), dal 1/1/2024: 50.005,77 € lordi annui per 13 mensilità. Da solo non è la retribuzione completa: vedi le componenti fisse sotto",
            source: ARAN_AREA_SANITA_2022_2024,
            kind: "base",
          },
        ],
      },
      {
        name: "Componenti fisse previste dal CCNL (dirigente con rapporto esclusivo)",
        rows: [
          {
            service: "Indennità di esclusività, fino a 5 anni di anzianità da dirigente",
            year: 2021,
            annual: escl.fino5,
            note: `art. 64 c. 3 del CCNL 23/1/2024 (GU p. 54), valore annuo lordo con tredicesima, dal 1/1/2021`,
            source: GU_AREA_SANITA_2019_2021,
            kind: "component",
          },
          {
            service: "Indennità di esclusività, da 5 a 15 anni di anzianità",
            year: 2021,
            annual: escl.da5a15,
            note: "stesso articolo; con valutazione positiva",
            source: GU_AREA_SANITA_2019_2021,
            kind: "component",
          },
          {
            service: "Indennità di esclusività, oltre 15 anni di anzianità",
            year: 2021,
            annual: escl.oltre15,
            note: "stesso articolo; con valutazione positiva",
            source: GU_AREA_SANITA_2019_2021,
            kind: "component",
          },
          {
            service: "Indennità di esclusività, direzione di struttura complessa",
            year: 2021,
            annual: escl.struttura,
            note: "stesso articolo; sostituisce le fasce di anzianità",
            source: GU_AREA_SANITA_2019_2021,
            kind: "component",
          },
          {
            service: `Indennità di specificità (${specLabel})`,
            year: 2025,
            annual: spec,
            note: "art. 15 (PDF p. 23), valore annuo lordo con tredicesima, dal 31/12/2024 e a valere dal 2025",
            source: ARAN_AREA_SANITA_2022_2024,
            kind: "component",
          },
          {
            service: "Retribuzione di posizione, parte fissa minima (incarico professionale iniziale)",
            year: 2024,
            annual: posizione,
            note: "art. 14 c. 3 (PDF p. 20), dal 1/1/2024; gli incarichi più complessi hanno valori più alti",
            source: ARAN_AREA_SANITA_2022_2024,
            kind: "component",
          },
        ],
      },
      {
        name: "Totale a inizio carriera (tabellare + componenti fisse minime)",
        rows: [
          {
            service: "Dirigente fino a 5 anni di anzianità, rapporto esclusivo, incarico professionale iniziale",
            year: 2025,
            annual: total,
            note: `somma di tabellare ${cents(tabellare)} + esclusività ${cents(escl.fino5)} + ${specLabel} ${cents(spec)} + posizione parte fissa ${cents(posizione)}. Esclude parte variabile, risultato, guardie e straordinari`,
            source: ARAN_AREA_SANITA_2022_2024,
            kind: "total",
          },
        ],
      },
    ],
  };
}

export const CAREERS: Career[] = [
  comparto({
    slug: "infermiere",
    label: "infermiere",
    indefinite: "un infermiere",
    profession: "Infermieristica",
    ssnRole: "un infermiere",
    profili: "l'infermiere (e l'infermiere pediatrico)",
    area: "professionisti",
  }),
  comparto({
    slug: "ostetrica",
    label: "ostetrica",
    indefinite: "un'ostetrica",
    profession: "Ostetricia",
    ssnRole: "un'ostetrica",
    profili: "l'ostetrica",
    area: "professionisti",
  }),
  comparto({
    slug: "tecnico-sanitario",
    label: "tecnico sanitario",
    indefinite: "un tecnico sanitario",
    profession: "Tecnici sanitari",
    ssnRole: "un tecnico sanitario",
    profili:
      "il tecnico sanitario (di laboratorio biomedico, di radiologia medica, di neurofisiopatologia e le altre professioni tecnico sanitarie)",
    area: "professionisti",
  }),
  comparto({
    slug: "fisioterapista",
    label: "fisioterapista",
    indefinite: "un fisioterapista",
    profession: "Fisioterapia",
    ssnRole: "un fisioterapista",
    profili: "il fisioterapista",
    area: "professionisti",
  }),
  comparto({
    slug: "logopedista",
    label: "logopedista e professioni della riabilitazione",
    indefinite: "un logopedista",
    profession: "Logopedia e riabilitazione",
    ssnRole: "un logopedista (o altro professionista della riabilitazione)",
    profili:
      "il logopedista, come gli altri professionisti sanitari della riabilitazione (terapista occupazionale, educatore professionale socio-sanitario, ortottista, podologo e altri)",
    area: "professionisti",
  }),
  comparto({
    slug: "dietista",
    label: "dietista",
    indefinite: "un dietista",
    profession: "Nutrizione e dietistica",
    ssnRole: "un dietista",
    profili: "il dietista (professione tecnico sanitaria)",
    area: "professionisti",
  }),
  comparto({
    slug: "assistente-sociale",
    label: "assistente sociale",
    indefinite: "un assistente sociale",
    profession: "Servizio sociale",
    ssnRole: "un assistente sociale",
    profili: "l'assistente sociale (profilo del ruolo socio-sanitario)",
    area: "professionisti",
  }),
  comparto({
    slug: "oss",
    label: "OSS (operatore socio sanitario)",
    indefinite: "un OSS",
    profession: "OSS",
    ssnRole: "un OSS",
    profili: "l'operatore socio sanitario (OSS, ruolo sociosanitario)",
    area: "operatori",
  }),
  dirigenza({
    slug: "medico",
    label: "medico (dirigente medico)",
    indefinite: "un dirigente medico",
    profession: "Medicina",
    kind: "medica",
    qualifica: "un dirigente medico",
    intro:
      "Nel SSN il medico assunto dalle aziende sanitarie è un dirigente medico dell'Area Sanità. La retribuzione si compone di più voci: stipendio tabellare, indennità di esclusività (per chi ha rapporto esclusivo, a fasce di anzianità), indennità di specificità medico-veterinaria e retribuzione di posizione, più guardie, straordinari e risultato. Il solo tabellare sottostima quindi la retribuzione: sotto trovi anche le componenti fisse fissate dal CCNL. Nel privato e nell'accreditato si applicano altri contratti o accordi individuali.",
  }),
  dirigenza({
    slug: "veterinario",
    label: "veterinario (dirigente veterinario)",
    indefinite: "un dirigente veterinario",
    profession: "Veterinaria",
    kind: "medica",
    qualifica: "un dirigente veterinario",
    intro:
      "Nel SSN (aziende sanitarie, servizi veterinari, istituti zooprofilattici) il veterinario è un dirigente veterinario dell'Area Sanità, con lo stesso stipendio tabellare e le stesse indennità di esclusività e di specificità medico-veterinaria dei dirigenti medici. Il solo tabellare sottostima la retribuzione: sotto trovi anche le componenti fisse fissate dal CCNL. Nel privato (cliniche, studi) non si applicano queste tabelle.",
  }),
  dirigenza({
    slug: "farmacista",
    label: "farmacista (dirigente farmacista nel SSN)",
    indefinite: "un dirigente farmacista",
    profession: "Farmacia",
    kind: "sanitaria",
    qualifica: "un dirigente farmacista",
    intro:
      "Questa pagina riguarda solo il farmacista dirigente del SSN (farmacia ospedaliera e territoriale delle aziende sanitarie), inquadrato nella dirigenza sanitaria dell'Area Sanità. Le farmacie private e le parafarmacie applicano altri contratti e non rientrano in queste tabelle. La retribuzione si compone di stipendio tabellare, indennità di esclusività, indennità di specificità sanitaria e retribuzione di posizione: il solo tabellare sottostima la retribuzione.",
  }),
  dirigenza({
    slug: "psicologo",
    label: "psicologo (dirigente psicologo nel SSN)",
    indefinite: "un dirigente psicologo",
    profession: "Psicologia",
    kind: "sanitaria",
    qualifica: "un dirigente psicologo",
    intro:
      "Nel SSN lo psicologo assunto dalle aziende sanitarie è un dirigente psicologo della dirigenza sanitaria dell'Area Sanità. La retribuzione si compone di stipendio tabellare, indennità di esclusività, indennità di specificità sanitaria e retribuzione di posizione: il solo tabellare sottostima la retribuzione. Nel privato, nell'accreditato e nella libera professione non si applicano queste tabelle.",
  }),
];

/** true quando esiste almeno una professione con dati verificati e fonti citate. */
export function hasSalaryData() {
  return CAREERS.length > 0;
}

export function careerFromSlug(slug: string) {
  return CAREERS.find((career) => career.slug === slug) ?? null;
}

export function careerForProfession(profession: string | null) {
  if (!profession) return null;
  return CAREERS.find((career) => career.profession === profession) ?? null;
}

/** Righe che entrano nei riepiloghi (tabellare e totale; le componenti fisse restano solo nel dettaglio). */
function summaryRows(career: Career) {
  return career.tables.flatMap((t) => t.rows).filter((r) => r.kind !== "component");
}

export function careerRange(career: Career) {
  const monthly = summaryRows(career).map((r) => r.annual / 12);
  return { min: Math.min(...monthly), max: Math.max(...monthly) };
}

/** Riga di partenza: il totale a inizio carriera se esiste (dirigenza), altrimenti la tabellare più bassa. */
export function careerEntry(career: Career) {
  const rows = summaryRows(career);
  const total = rows.find((r) => r.kind === "total");
  const row = total ?? rows.reduce((min, r) => (r.annual < min.annual ? r : min), rows[0]);
  return { row, annual: row.annual, monthlyEquivalent: row.annual / 12 };
}

/** Solo lo stipendio tabellare (null se coincide con la riga di partenza). */
export function careerBase(career: Career) {
  const row = career.tables.flatMap((t) => t.rows).find((r) => r.kind === "base");
  return row && row !== careerEntry(career).row ? row : null;
}

export function formatEur(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEurRound(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
