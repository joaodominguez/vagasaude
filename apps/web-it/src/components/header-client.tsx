"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { FavoritesBadge } from "./favorites-badge";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/offerte", label: "Offerte" },
  { href: "/concorsi", label: "Concorsi" },
  { href: "/aziende", label: "Aziende" },
  { href: "/dati", label: "Dati" },
  { href: "/notizie", label: "Notizie" },
  { href: "/preferiti", label: "Preferiti" },
  { href: "/avvisi", label: "Crea avviso" },
] as const;

const NEWS_HREF = "/notizie";

export function HeaderClient({ showNews }: { showNews: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Senza notizie pubblicate, il link porterebbe a una pagina vuota.
  const navItems = NAV_ITEMS.filter((item) => showNews || item.href !== NEWS_HREF);

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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-lg">
      <div className="page-container flex h-16 items-center justify-between">
        <Logo />

        <nav
          aria-label="Navigazione principale"
          className="hidden items-center gap-8 text-sm font-semibold md:flex"
        >
          {navItems.map((item) => (
            <Link key={item.href} className="nav-link" href={item.href} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <FavoritesBadge />
          <ThemeToggle />
          <button
            type="button"
            className="icon-button md:hidden"
            aria-label={open ? "Chiudi il menu" : "Apri il menu"}
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
          aria-label="Navigazione mobile"
          className="page-container flex flex-col gap-1 py-3"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
