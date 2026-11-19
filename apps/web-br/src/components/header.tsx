"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { FavoritesBadge } from "./favorites-badge";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SocialLinks } from "./social-links";

const NAV_ITEMS = [
  { href: "/vagas", label: "Buscar vagas" },
  { href: "/concursos", label: "Concursos" },
  { href: "/salarios", label: "Salários" },
  { href: "/noticias", label: "Notícias" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/alertas", label: "Criar alerta" },
  { href: "/como-funciona", label: "Como funciona" },
] as const;

const ALERT_HREF = "/alertas";
/** Itens do menu que, em tela média, cedem lugar ao botão «Criar alerta» (continuam no menu mobile). */
const SECONDARY_HREFS = new Set<string>(["/favoritos", "/como-funciona"]);

export function Header() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 shadow-[0_2px_12px_rgb(15_23_42/0.05)] dark:shadow-[0_2px_12px_rgb(0_0_0/0.35)] bg-background/90 backdrop-blur-lg">
      <div className="page-container header-bar">
        <Logo />

        <nav
          aria-label="Navegação principal"
          className="hidden items-center justify-center gap-6 text-sm font-semibold md:flex lg:gap-8"
        >
          {NAV_ITEMS.filter((item) => item.href !== ALERT_HREF).map((item) => (
            <Link
              key={item.href}
              className={SECONDARY_HREFS.has(item.href) ? "nav-link hidden lg:inline" : "nav-link"}
              href={item.href}
              prefetch={false}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link href={ALERT_HREF} prefetch={false} className="header-cta hidden md:inline-flex">
            <Bell size={16} aria-hidden="true" />
            Criar alerta
          </Link>
          <FavoritesBadge />
          <ThemeToggle />
          <button
            type="button"
            className="icon-button md:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div
        id={panelId}
        className={open ? "mobile-nav is-open md:hidden" : "mobile-nav md:hidden"}
        hidden={!open}
      >
        <nav
          aria-label="Navegação mobile"
          className="page-container flex flex-col gap-1 py-3"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <SocialLinks className="mt-2 border-t border-border px-0.5 pt-4 pb-1" />
        </nav>
      </div>
    </header>
  );
}
