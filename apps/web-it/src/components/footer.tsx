import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-container grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Le offerte di lavoro nella sanità in Italia in un unico posto.
            Semplice, aggiornato e facile da usare.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
          <Link className="hover:text-primary" href="/aziende">
            Aziende
          </Link>
          <Link className="hover:text-primary" href="/dati">
            Dati
          </Link>
          <Link className="hover:text-primary" href="/contatti">
            Contatti
          </Link>
          <Link className="hover:text-primary" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-primary" href="/note-legali">
            Note legali
          </Link>
          <Link
            className="hover:text-primary"
            href="/admin"
            prefetch={false}
          >
            Amministrazione
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="page-container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 text-xs text-muted">
          <p>
            © {new Date().getFullYear()} Offerte Sanità. Le candidature si
            inviano sui siti degli enti e delle aziende.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Anche in</span>
            <a className="hover:text-primary" href="https://vagasaude.pt/" hrefLang="pt-PT">
              Portogallo
            </a>
            <a className="hover:text-primary" href="https://vagasaude.com.br/" hrefLang="pt-BR">
              Brasile
            </a>
            <a className="hover:text-primary" href="https://vacantessalud.es/" hrefLang="es">
              Spagna
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
