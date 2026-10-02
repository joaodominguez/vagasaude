import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { FavoritesClient } from "./favorites-client";

export const metadata: Metadata = {
  title: "Vagas salvas",
  description: "As vagas de saúde que você salvou para consultar mais tarde.",
  robots: { index: false, follow: false },
};

export default function FavoritosPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <p className="section-kicker">Seus favoritos</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
              Vagas salvas
            </h1>
            <p className="mt-2 text-sm text-muted">
              As vagas que você salvou ficam aqui. Os dados são guardados apenas no
              seu navegador.
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
