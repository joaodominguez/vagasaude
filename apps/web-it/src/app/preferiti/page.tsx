import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { FavoritesClient } from "./favorites-client";

export const metadata: Metadata = {
  title: "Offerte salvate",
  description: "Le offerte di lavoro nella sanità che hai salvato per consultarle più tardi.",
  robots: { index: false, follow: false },
};

export default function PreferitiPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <p className="section-kicker">I tuoi preferiti</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
              Offerte salvate
            </h1>
            <p className="mt-2 text-sm text-muted">
              Le offerte che salvi appariranno qui. I dati restano memorizzati solo nel
              tuo browser.
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
