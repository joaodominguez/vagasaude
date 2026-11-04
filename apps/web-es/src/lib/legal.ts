/**
 * Datos legales del titular del sitio. ÚNICA fuente de verdad: las páginas
 * /aviso-legal, /privacidad y /cookies leen de aquí.
 *
 * ⚠️ ANTES DEL LANZAMIENTO hay que sustituir TODOS los valores entre corchetes
 * "[...]" por los datos reales (LSSI-CE art. 10 y RGPD art. 13 obligan a
 * identificar al titular). `LEGAL_PLACEHOLDERS_PENDING` es true mientras quede
 * algún marcador, y las páginas muestran un aviso interno en ese caso (solo en
 * desarrollo, no en producción).
 */
export const LEGAL_OWNER = {
  /** Nombre y apellidos (autónomo) o razón social (sociedad). */
  name: "Truecode, Lda.",
  /** NIF / NIE / CIF. */
  taxId: "513626409 (NIF de Portugal)",
  /** Domicilio postal completo. */
  address: "Rua São Romão, n.º 43, Portugal",
  /** Email de contacto general y para ejercer derechos de protección de datos. */
  email: "hola@vacantessalud.es",
  /** Datos registrales (solo si es sociedad inscrita en el Registro Mercantil); dejar "" si no aplica. */
  registry: "",
  /** Teléfono (opcional). */
  phone: "",
} as const;

/** Fecha de última actualización de los textos legales. Actualizar al editarlos. */
export const LEGAL_LAST_UPDATED = "4 de noviembre de 2026";

/**
 * Plazo de conservación de logs del servidor. VERIFICAR con la configuración
 * real del servidor (logrotate / journald) antes del lanzamiento.
 */
export const LOG_RETENTION = "90 días";

export const LEGAL_PLACEHOLDERS_PENDING = [
  LEGAL_OWNER.name,
  LEGAL_OWNER.taxId,
  LEGAL_OWNER.address,
].some((value) => value.startsWith("["));
