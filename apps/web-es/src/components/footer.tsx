import Link from "next/link";
import { CookieSettingsButton } from "./cookie-settings-button";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-container grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Todas las ofertas de empleo sanitario de España en un solo sitio.
            Sencillo, actualizado y fácil de usar.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
          <Link className="hover:text-primary" href="/empleo">
            Empleo
          </Link>
          <Link className="hover:text-primary" href="/favoritos">
            Favoritos
          </Link>
          <Link className="hover:text-primary" href="/alertas">
            Alertas
          </Link>
          <Link className="hover:text-primary" href="/como-funciona">
            Cómo funciona
          </Link>
          <Link className="hover:text-primary" href="/privacidad">
            Privacidad
          </Link>
          <Link className="hover:text-primary" href="/aviso-legal">
            Aviso legal
          </Link>
          <Link className="hover:text-primary" href="/cookies">
            Cookies
          </Link>
          <CookieSettingsButton className="hover:text-primary" />
          <Link
            className="hover:text-primary"
            href="/admin"
            prefetch={false}
          >
            Administración
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="page-container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 text-xs text-muted">
          <p>
            © {new Date().getFullYear()} VacantesSalud. Las solicitudes se hacen
            en las webs de las entidades.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>También en</span>
            <a className="hover:text-primary" href="https://vagasaude.pt/">
              Portugal
            </a>
            <a className="hover:text-primary" href="https://vagasaude.com.br/">
              Brasil
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
