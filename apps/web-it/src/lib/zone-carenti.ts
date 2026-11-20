import lombardia from "@/data/zone-carenti/lombardia.json";
import piemonte from "@/data/zone-carenti/piemonte.json";
import toscana from "@/data/zone-carenti/toscana.json";
import emiliaRomagna from "@/data/zone-carenti/emilia-romagna.json";

/**
 * Zone carenti / incarichi vacanti di assistenza primaria (medicina generale, pediatria di libera scelta, 118).
 * Dati: pubblicazioni ufficiali delle Regioni (BUR + pagina istituzionale), estratti da scrapers-it/zone_carenti.
 * Solo ambiti, posti e scadenze: nessun dato personale (graduatorie nominative e punteggi sono esclusi).
 */

export type ZcTipo = "ruolo-unico" | "pls" | "emergenza-territoriale";

export type ZcVoce = { asl: string; ambito: string; posti: number; note: string };
export type ZcAsl = { asl: string; posti: number; ambiti: number };

export type ZcPubblicazione = {
  id: string;
  tipo: ZcTipo;
  titolo: string;
  edizione: string;
  anno: number;
  pubblicatoIl: string; // AAAA-MM-GG
  bollettino: string;
  scadenza: string | null;
  scadenzaCalcolata: boolean;
  paginaUrl: string;
  pdfUrl: string;
  bollettinoUrl: string | null;
  totalePosti: number;
  totaleUfficiale: number | null;
  nota: string;
  corrente: boolean;
  perAsl: ZcAsl[];
  voci?: ZcVoce[];
};

export type ZcRegione = {
  slug: string;
  nome: string;
  ente: string;
  paginaUfficiale: string;
  bollettinoNome: string;
  ultimoAggiornamentoFonte: string;
  generatoIl: string;
  note: string[];
  esclusi: string[];
  pubblicazioni: ZcPubblicazione[];
};

export const ZC_HUB_PATH = "/zone-carenti";
export const zcRegionPath = (slug: string) => `${ZC_HUB_PATH}/${slug}`;

export const REGIONI: ZcRegione[] = [lombardia, piemonte, toscana, emiliaRomagna] as unknown as ZcRegione[];

export const TIPO_LABEL: Record<ZcTipo, string> = {
  "ruolo-unico": "Medicina generale (ruolo unico di assistenza primaria)",
  pls: "Pediatria di libera scelta",
  "emergenza-territoriale": "Emergenza territoriale 118",
};
export const TIPO_SHORT: Record<ZcTipo, string> = {
  "ruolo-unico": "Medicina generale",
  pls: "Pediatria",
  "emergenza-territoriale": "118",
};
export const TIPO_UNIT: Record<ZcTipo, string> = {
  "ruolo-unico": "incarichi vacanti",
  pls: "ambiti carenti",
  "emergenza-territoriale": "incarichi vacanti",
};
const TIPO_ORDER: ZcTipo[] = ["ruolo-unico", "pls", "emergenza-territoriale"];

export function getRegione(slug: string): ZcRegione | undefined {
  return REGIONI.find((r) => r.slug === slug);
}

/** Data odierna in Italia, AAAA-MM-GG. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(now);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("it-IT", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const int = (n: number) => n.toLocaleString("it-IT");

export function isOpen(p: ZcPubblicazione, today = todayIso()): boolean {
  return p.scadenza !== null && p.scadenza >= today;
}

export function statusLabel(p: ZcPubblicazione, today = todayIso()): string {
  if (!p.scadenza) return "scadenza non indicata";
  return isOpen(p, today)
    ? `candidature aperte fino al ${formatDate(p.scadenza)}`
    : `scadute il ${formatDate(p.scadenza)} (pubblicazione ${p.anno})`;
}

/** Pubblicazioni «correnti» (le più recenti per tipo, con elenco completo), ordinate per tipo. */
export function currentPublications(r: ZcRegione): ZcPubblicazione[] {
  return r.pubblicazioni
    .filter((p) => p.corrente)
    .sort((a, b) => TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo) || b.pubblicatoIl.localeCompare(a.pubblicatoIl));
}

export function earlierPublications(r: ZcRegione): ZcPubblicazione[] {
  return r.pubblicazioni.filter((p) => !p.corrente).sort((a, b) => b.pubblicatoIl.localeCompare(a.pubblicatoIl));
}

export function officialTotal(p: ZcPubblicazione): number {
  return p.totaleUfficiale ?? p.totalePosti;
}

export function regionTotals(r: ZcRegione) {
  const cur = currentPublications(r);
  const byTipo = new Map<ZcTipo, number>();
  for (const p of cur) byTipo.set(p.tipo, (byTipo.get(p.tipo) ?? 0) + officialTotal(p));
  return { byTipo, total: [...byTipo.values()].reduce((a, b) => a + b, 0), cur };
}

/** lastmod = data di pubblicazione ufficiale più recente tra le pubblicazioni della regione. */
export function regionLastmod(r: ZcRegione): Date {
  const latest = r.pubblicazioni.reduce((m, p) => (p.pubblicatoIl > m ? p.pubblicatoIl : m), "2000-01-01");
  return new Date(`${latest}T00:00:00Z`);
}

export function hubLastmod(): Date {
  return REGIONI.reduce((m, r) => (regionLastmod(r) > m ? regionLastmod(r) : m), new Date("2026-01-01T00:00:00Z"));
}

/** Pubblicazioni aperte oggi (tutte le regioni). */
export function openPublications(today = todayIso()) {
  return REGIONI.flatMap((r) => r.pubblicazioni.filter((p) => isOpen(p, today)).map((p) => ({ regione: r, pub: p })));
}

export const LAZIO = {
  nome: "Lazio",
  pubblicatoIl: "2026-11-10",
  scadenza: "2026-11-30", // 20 giorni dal giorno successivo alla pubblicazione sul BUR (calcolata)
  bollettino: "BUR Lazio n. 90, supplemento 1, del 10/11/2026 (determinazione G15489 del 06/11/2026)",
  paginaUrl: "https://www.regione.lazio.it/notizie/salute/Assegnazione-incarichi-vacanti-medico-ruolo-unico-assistenza-primaria",
};
