"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Rss,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/logo";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/vagas", label: "Vagas", icon: BriefcaseBusiness },
  { href: "/admin/fontes", label: "Fontes", icon: Rss },
  { href: "/admin/scrapers", label: "Scrapers", icon: RefreshCw },
  { href: "/admin/alertas", label: "Alertas", icon: Bell },
  { href: "/admin/sistema", label: "Sistema", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-border bg-surface p-5 lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <span className="tag tag-primary">Admin</span>
        </div>
        <nav className="mt-8 grid grid-cols-2 gap-1 text-sm lg:grid-cols-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold transition-colors ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-primary-soft hover:text-primary"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/"
          className="mt-8 hidden items-center gap-2 text-sm font-bold text-muted hover:text-primary lg:flex"
        >
          <LogOut size={16} /> Voltar ao site
        </Link>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
