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
};

const ARAN_COMPARTO_SANITA_2022_2024: SalarySource = {
  label: "ARAN, CCNL Comparto Sanità 2022-2024 (sottoscritto il 27/10/2025), Tabella 2a",
  url: "https://www.aranagenzia.it/wp-content/uploads/2025/10/2025.10.27-CCNL-comparto-definitivo-3.pdf",
};

export const CAREERS: Career[] = [
  {
    slug: "ostetrica",
    label: "ostetrica",
    indefinite: "un'ostetrica",
    profession: "Ostetricia",
    intro:
      "Nel pubblico (aziende sanitarie e ospedaliere) l'ostetrica rientra nell'Area dei professionisti della salute e dei funzionari del CCNL Comparto Sanità 2022-2024. La retribuzione tabellare è lorda e indicata per 12 mensilità più la tredicesima, a cui si aggiungono anzianità e indennità. Nel privato e nelle RSA si applicano altri contratti (per esempio AIOP o ARIS), con importi diversi.",
    tables: [
      {
        name: "Settore pubblico: CCNL Comparto Sanità 2022-2024",
        rows: [
          {
            service: "CCNL Comparto Sanità, Area dei professionisti della salute e dei funzionari (ostetrica)",
            year: 2024,
            annual: 26995.51,
            note: "retribuzione tabellare dal 1/1/2024: 24.918,93 € su 12 mensilità più tredicesima (24.918,93 ÷ 12 × 13)",
            source: ARAN_COMPARTO_SANITA_2022_2024,
          },
        ],
      },
    ],
  },
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

export function careerRange(career: Career) {
  const monthly = career.tables.flatMap((t) => t.rows.map((r) => r.annual / 12));
  return { min: Math.min(...monthly), max: Math.max(...monthly) };
}

export function careerEntry(career: Career) {
  const rows = career.tables.flatMap((t) => t.rows);
  const row = rows.reduce((min, r) => (r.annual < min.annual ? r : min), rows[0]);
  return { row, annual: row.annual, monthlyEquivalent: row.annual / 12 };
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
