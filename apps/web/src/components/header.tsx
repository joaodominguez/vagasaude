"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { FavoritesBadge } from "./favorites-badge";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SocialLinks } from "./social-links";

const NAV_ITEMS = [
  { href: "/vagas", label: "Procurar vagas" },
  { href: "/vagas/hoje", label: "Vagas de hoje" },
  { href: "/concursos", label: "Concursos" },
  { href: "/salarios", label: "Salários" },
  { href: "/noticias", label: "Notícias" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/alertas", label: "Criar alerta" },
] as const;

const ALERT_HREF = "/alertas";
/** Fora do menu de texto no ecrã grande (o alerta é o botão; favoritos é o coração). Ficam no menu móvel. */
const DESKTOP_HIDDEN = new Set<string>([ALERT_HREF]);
// Favoritos e Vagas de hoje: no menu de desktop a partir de 1024 px (abaixo ficam no menu móvel).
const SECONDARY_HREFS = new Set<string>(["/favoritos", "/vagas/hoje"]);

export function Header() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fecha e devolve o foco ao botão (Esc, fundo, botão); os links só fecham, porque navegam.
  function closeMenu() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Menu aberto: bloqueia o scroll da página (sem saltar: a posição fica no sítio e compensa-se a
  // barra de scroll) e leva o foco ao primeiro link.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const { overflow, paddingRight } = html.style;
    const gap = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (gap > 0) html.style.paddingRight = `${gap}px`;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      html.style.overflow = overflow;
      html.style.paddingRight = paddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
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
      <div className="page-container flex h-16 items-center justify-between">
        <Logo />

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 whitespace-nowrap text-sm font-semibold md:flex lg:gap-4 lg:text-[13px] xl:gap-8 xl:text-sm"
        >
          {NAV_ITEMS.filter((item) => !DESKTOP_HIDDEN.has(item.href)).map((item) => (
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

        <div className="flex items-center gap-2">
          <Link href={ALERT_HREF} prefetch={false} className="header-cta hidden md:inline-flex">
            <Bell size={16} aria-hidden="true" />
            Criar alerta
          </Link>
          <FavoritesBadge />
          <ThemeToggle />
          <button
            ref={buttonRef}
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

      {open ? <div className="mobile-nav-backdrop md:hidden" aria-hidden="true" onClick={closeMenu} /> : null}
      <div
        id={panelId}
        ref={panelRef}
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
