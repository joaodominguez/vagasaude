import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { FavoritesClient } from "./favorites-client";

export const metadata: Metadata = {
  title: "Ofertas guardadas",
  description: "Las ofertas de empleo sanitario que has guardado para consultar más tarde.",
  robots: { index: false, follow: false },
};

export default function FavoritosPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <p className="section-kicker">Os teus favoritos</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
              Ofertas guardadas
            </h1>
            <p className="mt-2 text-sm text-muted">
              Las ofertas que guardes aparecerán aquí. Los datos se guardan solo en
              tu navegador.
            </p>
          </div>
        </section>
        <div className="page-container py-10">
          <FavoritesClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
