import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LegalOwnerList } from "@/components/legal-owner";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_OWNER,
  LOG_RETENTION,
} from "@/lib/legal";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `Política de privacidad de ${SITE_NAME}: responsable, finalidades, base jurídica, destinatarios, plazos de conservación y tus derechos (RGPD y LOPDGDD).`;

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: DESCRIPTION,
  alternates: { canonical: "/privacidad" },
  openGraph: {
    title: `Política de privacidad | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/privacidad",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Transparencia</p>
          <h1>Política de privacidad</h1>
          <p>
            Última actualización: {LEGAL_LAST_UPDATED}. Cumplimos el Reglamento
            (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
          </p>

          <h2>1. Responsable del tratamiento</h2>
          <LegalOwnerList />
          <p>
            Para cualquier cuestión sobre tus datos escribe a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.
          </p>

          <h2>2. Qué datos tratamos, para qué y con qué base jurídica</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Finalidad</th>
                  <th>Datos</th>
                  <th>Base jurídica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Alertas de empleo por correo: confirmar la suscripción y
                    enviarte ofertas que coincidan con tus filtros.
                  </td>
                  <td>
                    Correo electrónico, filtros elegidos (provincia, profesión,
                    sector), fechas de alta, confirmación y baja, token de
                    gestión.
                  </td>
                  <td>
                    Consentimiento (art. 6.1.a RGPD), con doble confirmación
                    (double opt-in).
                  </td>
                </tr>
                <tr>
                  <td>
                    Analítica web: medir el uso del Sitio y mejorarlo (Google
                    Analytics, Microsoft Clarity).
                  </td>
                  <td>
                    Identificadores en cookies, páginas visitadas, interacciones,
                    dispositivo y navegador, ubicación aproximada.
                  </td>
                  <td>
                    Interés legítimo en medir y mejorar el servicio (art. 6.1.f
                    RGPD). Puedes oponerte en cualquier momento desde
                    «Configurar cookies» en la política de cookies.
                  </td>
                </tr>
                <tr>
                  <td>
                    Seguridad y funcionamiento del servidor: registros de
                    acceso, prevención de abusos y fraude.
                  </td>
                  <td>Dirección IP, fecha y hora, URL solicitada, agente de usuario.</td>
                  <td>Interés legítimo (art. 6.1.f RGPD) en la seguridad del servicio.</td>
                </tr>
                <tr>
                  <td>Atender tus consultas y el ejercicio de derechos.</td>
                  <td>Correo y contenido del mensaje.</td>
                  <td>
                    Consentimiento al contactarnos / cumplimiento de
                    obligaciones legales (art. 6.1.a y 6.1.c RGPD).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Estadísticas propias:</strong> además de lo anterior,
            recopilamos estadísticas de uso anónimas y agregadas, sin cookies y
            sin almacenar nada en tu dispositivo. No se guardan direcciones IP.
            Estos datos se usan únicamente para mejorar el servicio.
          </p>
          <p>
            <strong>Favoritos:</strong> se guardan solo en el almacenamiento
            local de tu navegador y no se envían a nuestros servidores.{" "}
            <strong>Candidaturas:</strong> se realizan en las webs de las
            entidades empleadoras; {SITE_NAME} no recibe ni almacena currículos.
            Al salir hacia esas webs, se aplican sus propias políticas de
            privacidad.
          </p>
          <p>
            No tomamos decisiones automatizadas con efectos jurídicos sobre ti
            ni elaboramos perfiles distintos del filtrado de ofertas que tú
            configuras. No tratamos categorías especiales de datos. El servicio
            no está dirigido a menores de 14 años.
          </p>

          <h2>3. Destinatarios y encargados del tratamiento</h2>
          <p>
            No vendemos tus datos. Solo los comunicamos a proveedores que
            actúan como encargados del tratamiento o terceros necesarios para
            prestar el servicio, y a las autoridades cuando la ley lo exija:
          </p>
          <ul>
            <li>
              <strong>Hetzner Online GmbH (Alemania, UE):</strong> alojamiento
              del servidor donde se almacenan los datos de alertas y registros.
            </li>
            <li>
              <strong>Resend (Estados Unidos):</strong> envío de correos
              transaccionales y de alertas. Transferencia internacional
              amparada en el Marco de Privacidad de Datos UE-EE. UU. y/o
              cláusulas contractuales tipo de la Comisión Europea.
            </li>
            <li>
              <strong>Google (Google Analytics):</strong> analítica web (puedes
              rechazarla en la política de cookies). Puede implicar transferencias a Estados
              Unidos bajo el Marco de Privacidad de Datos UE-EE. UU. y/o
              cláusulas contractuales tipo.
            </li>
            <li>
              <strong>Microsoft (Clarity):</strong> mapas de calor y grabación
              de sesiones, solo con tu consentimiento. Puede implicar
              transferencias a Estados Unidos con las mismas garantías.
            </li>
          </ul>
          <p>
            Más detalle sobre cookies y terceros en la{" "}
            <Link href="/cookies">política de cookies</Link>.
          </p>

          <h2>4. Plazos de conservación</h2>
          <ul>
            <li>
              <strong>Alertas:</strong> mientras mantengas la suscripción. Si
              te das de baja, conservamos el mínimo necesario (bloqueado) para
              atender posibles reclamaciones durante los plazos de prescripción
              legales y para no volver a escribirte; después se suprime. Las
              suscripciones sin confirmar se eliminan transcurrido un tiempo
              razonable.
            </li>
            <li>
              <strong>Analítica:</strong> hasta que la rechaces o
              expiren las cookies (ver política de cookies); los datos de Google
              Analytics y Clarity se conservan según la configuración de
              retención de cada herramienta.
            </li>
            <li>
              <strong>Registros del servidor:</strong> {LOG_RETENTION}.
            </li>
            <li>
              <strong>Consultas:</strong> el tiempo necesario para atenderlas y,
              después, durante los plazos legales de prescripción.
            </li>
          </ul>

          <h2>5. Tus derechos</h2>
          <p>
            Puedes ejercer los derechos de acceso, rectificación, supresión,
            oposición, limitación del tratamiento y portabilidad, así como
            retirar tu consentimiento en cualquier momento (sin afectar a la
            licitud del tratamiento previo), escribiendo a{" "}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>{" "}
            indicando el derecho que ejerces. Podemos pedirte que acredites tu
            identidad. Responderemos en el plazo máximo de un mes.
          </p>
          <ul>
            <li>
              Para darte de baja de las alertas, usa el enlace de cada correo o
              la página de gestión de alertas.
            </li>
            <li>
              Para cambiar tu consentimiento de cookies, usa «Configurar
              cookies» en el pie de página.
            </li>
          </ul>

          <h2>6. Reclamaciones</h2>
          <p>
            Si consideras que tus datos no se tratan correctamente, puedes
            presentar una reclamación ante la Agencia Española de Protección de
            Datos (AEPD):{" "}
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.aepd.es
            </a>
            , C/ Jorge Juan, 6, 28001 Madrid.
          </p>

          <h2>7. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y organizativas razonables: conexiones
            cifradas (HTTPS), acceso restringido a los datos y a la zona de
            administración, y tokens únicos para gestionar las alertas.
          </p>

          <h2>8. Cambios en esta política</h2>
          <p>
            Podemos actualizar esta política para reflejar cambios legales o del
            servicio. Publicaremos aquí la versión vigente con su fecha.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
