import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="page-container flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <p className="section-kicker">Errore 404</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">
          Questa pagina non è più disponibile.
        </h1>
        <p className="mt-3 max-w-md text-muted">
          L’offerta potrebbe essere scaduta oppure l’indirizzo potrebbe non essere corretto.
        </p>
        <Link href="/offerte" className="button button-primary mt-7">
          Vedi le offerte attive
        </Link>
      </main>
      <Footer />
    </>
  );
}
