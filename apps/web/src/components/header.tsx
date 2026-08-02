import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-lg">
      <div className="page-container flex h-17 items-center justify-between">
        <Logo />

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 text-sm font-semibold md:flex"
        >
          <Link className="nav-link" href="/vagas">
            Procurar vagas
          </Link>
          <Link className="nav-link" href="/alertas">
            Criar alerta
          </Link>
          <Link className="nav-link" href="/#sobre">
            Sobre
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/vagas"
            className="icon-button md:hidden"
            aria-label="Abrir lista de vagas"
          >
            <Menu size={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
