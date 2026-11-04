import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: `Cómo ${SITE_NAME} agrega ofertas de empleo sanitario, cómo funcionan las alertas y dónde te inscribes.`,
  alternates: { canonical: "/como-funciona" },
  openGraph: {
    title: `Cómo funciona | ${SITE_NAME}`,
    description: `Cómo ${SITE_NAME} agrega ofertas de empleo sanitario, cómo funcionan las alertas y dónde te inscribes.`,
    url: "/como-funciona",
    type: "website",
  },
};

const FAQ = [
  {
    q: `¿${SITE_NAME} es una web de selección de personal?`,
    a: "No. Somos un agregador: reunimos ofertas del sector sanitario publicadas por hospitales, grupos privados, entidades concertadas y fuentes públicas. La solicitud se hace siempre en la web oficial de la entidad.",
  },
  {
    q: "¿Cómo me inscribo en una oferta?",
    a: `Abre la oferta en ${SITE_NAME}, revisa los detalles y usa el botón de inscripción. Te llevamos a la página de la entidad empleadora: no enviamos currículums ni tramitamos solicitudes.`,
  },
  {
    q: "¿De dónde vienen las ofertas?",
    a: "De fuentes públicas (boletines oficiales, bolsas de empleo de los servicios de salud) y de las webs de empleo de entidades sanitarias (hospitales, clínicas, residencias y grupos privados). Actualizamos las fuentes con regularidad y retiramos los anuncios caducados.",
  },
  {
    q: "¿Cómo funcionan las alertas?",
    a: "Eliges filtros (comunidad, profesión, sector), confirmas el email y recibes un aviso cuando aparece una oferta nueva que coincide. Puedes gestionar o cancelar la alerta en cualquier momento desde el email.",
  },
  {
    q: "¿Por qué solo veo ofertas del sector sanitario?",
    a: "Es la especialización del producto: enfermería, medicina, TCAE, técnicos y funciones del ecosistema sanitario (formación, farma, gestión hospitalaria). Así la búsqueda es más rápida y con menos ruido.",
  },
  {
    q: "¿Los datos son correctos?",
    a: "Hacemos lo posible por normalizar título, lugar y profesión, pero prevalece la fuente oficial. Si encuentras un error, el anuncio original de la entidad es la referencia.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="page-container py-14">
        <article className="prose-page mx-auto max-w-3xl">
          <p className="section-kicker">Transparencia</p>
          <h1>Cómo funciona</h1>
          <p>
            {SITE_NAME} existe para ahorrar tiempo a quien busca empleo
            sanitario en España: un sitio sencillo, actualizado y con filtros
            que tienen sentido para el sector.
          </p>

          <h2>En 3 pasos</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[0.98rem] leading-7 text-muted">
            <li>
              <strong className="text-foreground">Busca</strong> por
              profesión, comunidad o palabra clave.
            </li>
            <li>
              <strong className="text-foreground">Consulta</strong> el anuncio y
              confirma ubicación, sector y requisitos.
            </li>
            <li>
              <strong className="text-foreground">Inscríbete</strong> en la web
              de la entidad: nosotros solo hacemos de puente.
            </li>
          </ol>

          <h2>Preguntas frecuentes</h2>
          <div className="mt-4 space-y-5">
            {FAQ.map((item) => (
              <section key={item.q}>
                <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                  {item.q}
                </h3>
                <p className="mt-1.5 text-[0.98rem] leading-7 text-muted">
                  {item.a}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/empleo" className="button button-primary">
              Ver ofertas
            </Link>
            <Link href="/alertas" className="button button-secondary">
              Crear alerta
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
