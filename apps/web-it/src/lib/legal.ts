/**
 * Dati legali del titolare del sito. UNICA fonte di verita': le pagine
 * /note-legali, /privacy, /cookie e /contatti leggono da qui.
 *
 * Il titolare e' lo stesso della versione spagnola (Truecode, Lda.).
 * TODO prima del lancio: verificare con il titolare i dati da mostrare per
 * il mercato italiano (D.Lgs. 70/2003 art. 7, GDPR art. 13). Ogni valore tra
 * parentesi quadre "[...]" fa scattare `LEGAL_PLACEHOLDERS_PENDING`, che mostra
 * un avviso interno (solo in sviluppo, non in produzione).
 */
export const LEGAL_OWNER = {
  /** Ragione sociale. */
  name: "Truecode, Lda.",
  /** Partita IVA / NIF. */
  taxId: "513626409 (NIF portoghese)",
  /** Sede legale completa. */
  address: "Rua São Romão, n.º 43, Portogallo",
  /** Email di contatto generale e per esercitare i diritti sulla protezione dei dati. */
  email: "contatti@offertesanita.it",
  /** Dati di registro imprese (solo se applicabile); lasciare "" se non applicabile. */
  registry: "",
  /** Telefono (facoltativo). */
  phone: "",
} as const;

/** Data di ultimo aggiornamento dei testi legali. Aggiornare quando si modificano. */
export const LEGAL_LAST_UPDATED = "12 novembre 2026";

/**
 * Periodo di conservazione dei log del server. VERIFICARE con la configurazione
 * reale del server (logrotate / journald) prima del lancio.
 */
export const LOG_RETENTION = "90 giorni";

export const LEGAL_PLACEHOLDERS_PENDING = [
  LEGAL_OWNER.name,
  LEGAL_OWNER.taxId,
  LEGAL_OWNER.address,
].some((value) => value.startsWith("["));
