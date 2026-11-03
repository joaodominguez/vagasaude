import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Política de privacidad de ${SITE_NAME}: qué datos recogemos y cómo los usamos.`,
  alternates: { canonical: "/privacidad" },
  robots: { index: true, follow: true },
};

/*
 * TODO(legal ES): borrador técnico, NO es asesoramiento jurídico. Antes de
 * publicar hay que completar: identidad del responsable (razón social, NIF,
 * domicilio), aviso legal (LSSI-CE art. 10), política de cookies y banner de
 * consentimiento (GA4 / Clarity requieren consentimiento previo según la AEPD),
 * y base jurídica / plazos de conservación conforme al RGPD y la LOPDGDD.
 */
export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page">
          <p className="section-kicker">Transparencia</p>
          <h1>Política de privacidad</h1>
          <p>
            {SITE_NAME} recoge únicamente los datos necesarios para prestar los
            servicios solicitados, como la dirección de correo electrónico
            utilizada para crear alertas.
          </p>
          <h2>Alertas de empleo</h2>
          <p>
            El correo se utiliza exclusivamente para enviar oportunidades y
            comunicaciones relacionadas con la alerta. No vendemos datos
            personales ni los compartimos con terceros para publicidad.
          </p>
          <h2>Baja y supresión</h2>
          <p>
            Puedes cancelar la alerta o solicitar la supresión de tus datos
            escribiendo a{" "}
            <a href="mailto:privacidad@vacantessalud.es">
              privacidad@vacantessalud.es
            </a>
            .
          </p>
          <h2>Solicitudes de empleo</h2>
          <p>
            Las solicitudes se realizan en las webs de las entidades
            empleadoras. {SITE_NAME} no recibe ni almacena currículos en esta
            versión.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
