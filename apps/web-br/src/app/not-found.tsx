import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="page-container flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
        <p className="section-kicker">Erro 404</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">
          Esta página já não está disponível.
        </h1>
        <p className="mt-3 max-w-md text-muted">
          A vaga pode ter expirado ou o endereço pode estar incorreto.
        </p>
        <Link href="/vagas" className="button button-primary mt-7">
          Ver vagas ativas
        </Link>
      </main>
      <Footer />
    </>
  );
}
