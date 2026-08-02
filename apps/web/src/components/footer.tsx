import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-container grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Todas as vagas de saúde em Portugal num só sítio. Simples,
            atualizado e fácil de usar.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
          <Link className="hover:text-primary" href="/vagas">
            Vagas
          </Link>
          <Link className="hover:text-primary" href="/alertas">
            Alertas
          </Link>
          <Link className="hover:text-primary" href="/privacidade">
            Privacidade
          </Link>
          <Link className="hover:text-primary" href="/admin">
            Administração
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="page-container py-4 text-xs text-muted">
          © {new Date().getFullYear()} VagaSaúde. As candidaturas são feitas nos
          sites das entidades.
        </div>
      </div>
    </footer>
  );
}
