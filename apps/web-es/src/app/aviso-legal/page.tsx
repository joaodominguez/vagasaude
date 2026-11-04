import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LegalOwnerList } from "@/components/legal-owner";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const DESCRIPTION = `Aviso legal de ${SITE_NAME}: titular del sitio, condiciones de uso, propiedad intelectual, responsabilidad y ley aplicable.`;

export const metadata: Metadata = {
  title: "Aviso legal",
  description: DESCRIPTION,
  alternates: { canonical: "/aviso-legal" },
  openGraph: {
    title: `Aviso legal | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/aviso-legal",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function LegalNoticePage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Información legal</p>
          <h1>Aviso legal</h1>
          <p>Última actualización: {LEGAL_LAST_UPDATED}.</p>

          <h2>1. Información del titular</h2>
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de
            la sociedad de la información y de comercio electrónico (LSSI-CE),
            se informa de que el sitio web {SITE_URL.replace("https://", "")}{" "}
            (en adelante, «el Sitio») es titularidad de:
          </p>
          <LegalOwnerList />

          <h2>2. Naturaleza del servicio</h2>
          <p>
            {SITE_NAME} es un agregador de ofertas de empleo del sector
            sanitario en España. Reunimos y organizamos anuncios publicados por
            terceros (hospitales, servicios de salud, grupos privados,
            entidades concertadas y fuentes públicas) para facilitar su
            búsqueda.
          </p>
          <ul>
            <li>
              Las ofertas pertenecen a sus respectivos publicadores, que son los
              únicos responsables de su contenido, veracidad y vigencia.
            </li>
            <li>
              {SITE_NAME} no es una agencia de colocación ni una empresa de
              selección de personal, no interviene en los procesos de selección
              ni garantiza la obtención de un empleo.
            </li>
            <li>
              La candidatura se realiza siempre en la web de la entidad
              empleadora. El Sitio no recibe, almacena ni tramita currículos.
            </li>
            <li>
              Aunque actualizamos las fuentes con regularidad, una oferta puede
              haber caducado o modificado sus condiciones: consulta siempre la
              fuente original.
            </li>
          </ul>

          <h2>3. Condiciones de uso</h2>
          <p>
            El acceso y uso del Sitio es gratuito y atribuye la condición de
            usuario, que se compromete a utilizarlo conforme a la ley, la buena
            fe y este aviso legal. Queda prohibido:
          </p>
          <ul>
            <li>
              Usar el Sitio con fines ilícitos o lesivos de derechos de
              terceros.
            </li>
            <li>
              Extraer de forma masiva o automatizada el contenido (scraping),
              reproducirlo o reutilizarlo comercialmente sin autorización
              previa y por escrito.
            </li>
            <li>
              Introducir virus o realizar acciones que dañen, sobrecarguen o
              deterioren el funcionamiento del Sitio.
            </li>
            <li>
              Suscribir alertas con datos de terceros sin su consentimiento.
            </li>
          </ul>

          <h2>4. Propiedad intelectual e industrial</h2>
          <p>
            El diseño, código, estructura, textos propios, logotipos y marca de{" "}
            {SITE_NAME} son titularidad del titular del Sitio o se utilizan con
            licencia, y están protegidos por la normativa de propiedad
            intelectual e industrial. Las marcas, logotipos y contenidos de las
            entidades empleadoras y de las fuentes de las ofertas pertenecen a
            sus respectivos titulares; se muestran con finalidad meramente
            informativa y de enlace hacia el original. Si eres titular de
            derechos y consideras que algún contenido los vulnera, escríbenos a{" "}
            el correo indicado arriba y lo revisaremos con prontitud.
          </p>

          <h2>5. Responsabilidad</h2>
          <ul>
            <li>
              No garantizamos la disponibilidad continua del Sitio ni la
              ausencia de errores, y podemos suspenderlo o modificarlo sin
              previo aviso.
            </li>
            <li>
              No respondemos de la exactitud, actualidad o licitud de las
              ofertas de terceros ni de los daños derivados de su uso o de los
              procesos de selección.
            </li>
            <li>
              El Sitio contiene enlaces a webs de terceros sobre cuyo contenido
              y políticas no tenemos control ni asumimos responsabilidad.
            </li>
          </ul>

          <h2>6. Protección de datos y cookies</h2>
          <p>
            El tratamiento de datos personales se describe en la{" "}
            <Link href="/privacidad">política de privacidad</Link> y el uso de
            cookies en la <Link href="/cookies">política de cookies</Link>.
          </p>

          <h2>7. Legislación aplicable y jurisdicción</h2>
          <p>
            Este aviso legal se rige por la legislación española. Para
            cualquier controversia, las partes se someten a los juzgados y
            tribunales que correspondan conforme a la normativa aplicable; si
            el usuario tiene la condición de consumidor, serán competentes los
            de su domicilio. Para consultas o reclamaciones puedes contactar con
            nosotros en el correo indicado en el apartado 1.
          </p>

          <h2>8. Modificaciones</h2>
          <p>
            Podemos actualizar este aviso legal para adaptarlo a cambios
            legislativos o del servicio. La versión vigente es la publicada en
            esta página.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
