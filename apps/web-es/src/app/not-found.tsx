import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="page-container flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <p className="section-kicker">Error 404</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">
          Esta página ya no está disponible.
        </h1>
        <p className="mt-3 max-w-md text-muted">
          La oferta puede haber caducado o la dirección puede ser incorrecta.
        </p>
        <Link href="/empleo" className="button button-primary mt-7">
          Ver ofertas activas
        </Link>
      </main>
      <Footer />
    </>
  );
}
