import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { Header } from "@/components/header";
import { LEGAL_LAST_UPDATED, LEGAL_OWNER } from "@/lib/legal";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Política de cookies de ${SITE_NAME}: qué cookies y almacenamiento local usamos, para qué, cuánto duran y cómo cambiar tu consentimiento.`;

export const metadata: Metadata = {
  title: "Política de cookies",
  description: DESCRIPTION,
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: `Política de cookies | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/cookies",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Transparencia</p>
          <h1>Política de cookies</h1>
          <p>Última actualización: {LEGAL_LAST_UPDATED}.</p>

          <h2>1. ¿Qué son las cookies?</h2>
          <p>
            Las cookies son pequeños archivos que un sitio web guarda en tu
            dispositivo. Esta política también cubre tecnologías equivalentes,
            como el almacenamiento local del navegador (localStorage). Conforme
            al artículo 22.2 de la LSSI-CE, solo instalamos las que no son
            estrictamente necesarias si nos das tu consentimiento previo, y
            seguimos la Guía sobre el uso de las cookies de la AEPD.
          </p>

          <h2>2. Responsable</h2>
          <p>
            {LEGAL_OWNER.name} (NIF/NIE/CIF {LEGAL_OWNER.taxId}), contacto{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
            Consulta el <Link href="/aviso-legal">aviso legal</Link> y la{" "}
            <Link href="/privacidad">política de privacidad</Link>.
          </p>

          <h2>3. Cookies técnicas necesarias (sin consentimiento)</h2>
          <p>
            Imprescindibles para el funcionamiento del Sitio o para recordar tus
            preferencias. No se usan para publicidad ni analítica.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Finalidad</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>vs_consent</td>
                  <td>Cookie propia</td>
                  <td>
                    Guarda tu elección sobre cookies (versión y fecha) para no
                    volver a preguntarte.
                  </td>
                  <td>13 meses</td>
                </tr>
                <tr>
                  <td>vacantessalud-theme</td>
                  <td>localStorage propio</td>
                  <td>Recuerda el tema claro/oscuro elegido.</td>
                  <td>Hasta que lo borres</td>
                </tr>
                <tr>
                  <td>Favoritos</td>
                  <td>localStorage propio</td>
                  <td>
                    Guarda en tu navegador las ofertas que marcas como favoritas.
                    No se envían a nuestros servidores.
                  </td>
                  <td>Hasta que lo borres</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            El área de administración (solo para el titular) usa autenticación
            HTTP básica del navegador y no instala cookies de sesión para los
            visitantes.
          </p>

          <p>
            Además, medimos el uso del Sitio con estadísticas propias anónimas y
            agregadas que no usan cookies ni almacenan nada en tu dispositivo.
            No se guardan direcciones IP y los datos se usan únicamente para
            mejorar el servicio, por lo que no requieren consentimiento.
          </p>

          <h2>4. Cookies analíticas (solo con tu consentimiento)</h2>
          <p>
            Nos permiten medir el uso del Sitio y mejorarlo. No se instalan
            salvo que actives «Analíticas» en «Configurar cookies» (enlace al
            pie de cada página). Sin ese consentimiento, Google Analytics
            funciona en modo sin cookies (Consent Mode con almacenamiento
            denegado): no escribe ni lee cookies en tu dispositivo y solo recibe
            señales agregadas de visita sin identificadores. Microsoft Clarity
            no se carga sin tu consentimiento.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Proveedor</th>
                  <th>Finalidad</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>_ga</td>
                  <td>Google Analytics 4 (Google Ireland Ltd.)</td>
                  <td>Distingue usuarios de forma anónima para estadísticas.</td>
                  <td>2 años</td>
                </tr>
                <tr>
                  <td>_ga_&lt;ID&gt;</td>
                  <td>Google Analytics 4</td>
                  <td>Mantiene el estado de la sesión.</td>
                  <td>2 años</td>
                </tr>
                <tr>
                  <td>_clck</td>
                  <td>Microsoft Clarity (Microsoft Corp.)</td>
                  <td>Guarda el identificador de usuario y sesión de Clarity.</td>
                  <td>1 año</td>
                </tr>
                <tr>
                  <td>_clsk</td>
                  <td>Microsoft Clarity</td>
                  <td>Agrupa las páginas vistas en una sola sesión.</td>
                  <td>1 día</td>
                </tr>
                <tr>
                  <td>CLID, ANONCHK, MR, SM</td>
                  <td>Microsoft Clarity / Bing</td>
                  <td>
                    Identificación de cliente, comprobación de anonimato,
                    renovación y sincronización.
                  </td>
                  <td>De sesión a 1 año</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Las duraciones son las indicadas por los proveedores y pueden
            cambiar. No utilizamos cookies publicitarias ni de personalización
            de anuncios (ad_storage, ad_user_data y ad_personalization quedan
            siempre denegados en Google Consent Mode).
          </p>

          <h2>5. Terceros y transferencias internacionales</h2>
          <p>
            Google (Google Analytics) y Microsoft (Clarity) pueden tratar datos
            en Estados Unidos u otros países fuera del Espacio Económico
            Europeo. Dichas transferencias se amparan en la decisión de
            adecuación del Marco de Privacidad de Datos UE-EE. UU. (si el
            proveedor está certificado) y/o en cláusulas contractuales tipo de
            la Comisión Europea. Al aceptar las cookies analíticas consientes
            también estas transferencias. Más información en las políticas de
            privacidad de{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google
            </a>{" "}
            y de{" "}
            <a
              href="https://privacy.microsoft.com/es-es/privacystatement"
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft
            </a>
            .
          </p>

          <h2>6. Cómo cambiar o retirar tu consentimiento</h2>
          <p>
            Puedes cambiar tu elección en cualquier momento, con la misma
            facilidad con la que la diste:{" "}
            <CookieSettingsButton className="link-button" />. También puedes
            enlazarla desde el pie de cualquier página. Si retiras el
            consentimiento, eliminamos las cookies analíticas y dejamos de
            cargar los scripts. Se te volverá a preguntar pasados 13 meses o
            si cambiamos de forma relevante esta política.
          </p>
          <p>
            Además, puedes bloquear o eliminar cookies desde la configuración de
            tu navegador (Chrome, Firefox, Safari, Edge), teniendo en cuenta que
            algunas funciones del Sitio podrían dejar de funcionar.
          </p>

          <h2>7. Más información</h2>
          <p>
            Guía de la AEPD sobre cookies:{" "}
            <a
              href="https://www.aepd.es/guias/guia-cookies.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              aepd.es
            </a>
            . Si tienes dudas, escríbenos a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
