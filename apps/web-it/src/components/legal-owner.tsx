import { LEGAL_OWNER, LEGAL_PLACEHOLDERS_PENDING } from "@/lib/legal";

/** Bloque de identificación del titular (compartido por las páginas legales). */
export function LegalOwnerList() {
  return (
    <>
      {process.env.NODE_ENV !== "production" && LEGAL_PLACEHOLDERS_PENDING ? (
        <p>
          <strong>
            [Aviso interno: completar src/lib/legal.ts antes del lanzamiento]
          </strong>
        </p>
      ) : null}
      <ul>
        <li>Titular: {LEGAL_OWNER.name}</li>
        <li>NIF/NIE/CIF: {LEGAL_OWNER.taxId}</li>
        <li>Domicilio: {LEGAL_OWNER.address}</li>
        <li>
          Correo electrónico:{" "}
          <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>
        </li>
        {LEGAL_OWNER.phone ? <li>Teléfono: {LEGAL_OWNER.phone}</li> : null}
        {LEGAL_OWNER.registry ? (
          <li>Datos registrales: {LEGAL_OWNER.registry}</li>
        ) : null}
      </ul>
    </>
  );
}
