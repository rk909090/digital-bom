"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, BookOpen, ChevronsLeft, ChevronsRight, ClipboardList, Home, LogOut, Menu, PackageCheck, Plug, Scale, Settings, ShieldCheck, Snowflake, Truck, Warehouse, X } from "lucide-react";
import { logout } from "../actions/auth";
import { Avatar, Logo } from "@/components/logo";
import { cx } from "@/components/ui";
import { NAV_COOKIE, type NavMode } from "@/lib/nav";

const ICONS = { home: Home, plan: ClipboardList, warehouse: Warehouse, scale: Scale, output: PackageCheck, freezer: Snowflake, ship: Truck, verify: ShieldCheck, report: BarChart3, master: BookOpen, integration: Plug, settings: Settings };

export type NavItem = { href: string; label: string; short: string; icon: keyof typeof ICONS; badge?: number; alert?: boolean };
type User = { name: string; color: string; role: string };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function Badge({ n, alert, className }: { n?: number; alert?: boolean; className?: string }) {
  if (!n) return null;
  return <span className={cx("min-w-5 rounded-full px-1.5 text-center text-xs font-bold leading-5 text-white shadow-sm ring-2 ring-surface tnum", alert ? "bg-bad" : "bg-brand", className)}>{n > 99 ? "99+" : n}</span>;
}

/**
 * Navigasi adaptif:
 * - ≥1280 px: sidebar lebar (ikon + label lengkap)
 * - 1024–1279 px: sidebar ramping (ikon + label pendek)
 * - pengguna bisa menciutkan/melebarkan sendiri (tombol di samping lonceng, disimpan di cookie)
 * - <1024 px: bar atas 56 px + menu laci (drawer)
 */
export function AppNav({ items, user, bell, mobileBell, navMode = "auto" }: { items: NavItem[]; user: User; bell: ReactNode; mobileBell: ReactNode; navMode?: NavMode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NavMode>(navMode);
  /** Ciutkan bila sedang lebar, lebarkan bila sedang ramping. Pilihan disimpan 1 tahun di cookie. */
  const toggle = () => {
    const wideNow = mode === "wide" || (mode === "auto" && window.matchMedia("(min-width: 80rem)").matches);
    const next: NavMode = wideNow ? "rail" : "wide";
    setMode(next);
    document.cookie = `${NAV_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  const anyAlert = items.some((i) => i.alert);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ---------- sidebar (layar lebar) ---------- */}
      <aside data-nav={mode} className="sticky top-0 z-30 hidden h-dvh w-[92px] shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex navwide:w-60">
        <button
          type="button"
          onClick={toggle}
          title="Ciutkan / lebarkan menu"
          className="absolute top-[26px] -right-3.5 z-10 flex size-7 items-center justify-center rounded-full border border-line-strong bg-surface text-muted shadow-card transition hover:border-brand hover:text-brand"
        >
          <ChevronsLeft className="hidden size-4 navwide:block" aria-hidden="true" />
          <ChevronsRight className="size-4 navwide:hidden" aria-hidden="true" />
          <span className="sr-only navwide:hidden">Lebarkan menu</span>
          <span className="sr-only hidden navwide:inline">Ciutkan menu</span>
        </button>
        <div className="flex flex-col items-center gap-1 px-2 pt-3 pb-2 navwide:flex-row navwide:gap-2 navwide:px-4 navwide:pt-4">
          <Link href="/" className="hidden min-w-0 items-center gap-2.5 navwide:flex" aria-label="Beranda Smart Bakery">
            <Logo size={32} />
            <span className="hidden min-w-0 leading-tight navwide:block">
              <span className="block truncate font-extrabold">Smart Bakery</span>
              <span className="block text-xs text-muted">Produksi & BOM</span>
            </span>
          </Link>
          <div className="navwide:ml-auto">{bell}</div>
        </div>
        <nav aria-label="Menu utama" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin] navwide:px-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((it) => {
              const active = isActive(path, it.href);
              const Icon = ICONS[it.icon];
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    title={it.label}
                    className={cx(
                      "relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold leading-tight transition-colors navwide:flex-row navwide:gap-3 navwide:px-3 navwide:py-1.5 navwide:text-[15px]",
                      active ? "bg-brand-soft text-ink" : "text-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden="true" />}
                    <span className="relative">
                      <Icon className={cx("size-[22px] navwide:size-5", active && "text-brand")} />
                      <Badge n={it.badge} alert={it.alert} className="absolute -top-2 -right-3 navwide:hidden" />
                    </span>
                    <span className="text-center navwide:hidden">{it.short}</span>
                    <span className="hidden flex-1 truncate navwide:block">{it.label}</span>
                    <Badge n={it.badge} alert={it.alert} className="hidden navwide:inline-block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center justify-center gap-1 border-t border-line p-1.5 navwide:justify-start navwide:gap-2.5 navwide:p-3">
          <Avatar name={user.name} color={user.color} size={30} />
          <span className="hidden min-w-0 flex-1 leading-tight navwide:block">
            <span className="block truncate text-sm font-bold">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.role}</span>
          </span>
          <form action={logout}>
            <button type="submit" title="Keluar" aria-label="Keluar" className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-sunken hover:text-ink">
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
      </aside>

      {/* ---------- bar atas (layar sempit) ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur sm:px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Buka menu" aria-expanded={open} className="relative flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-sunken">
          <Menu className="size-6" />
          {anyAlert && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-bad ring-2 ring-surface" aria-hidden="true" />}
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Logo size={32} />
          <span className="truncate font-extrabold">Smart Bakery</span>
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {(() => {
            const cur = items.find((i) => i.href !== "/" && isActive(path, i.href));
            return cur ? `· ${cur.label}` : "";
          })()}
        </span>
        {mobileBell}
        <Avatar name={user.name} color={user.color} size={32} />
      </header>

      {/* ---------- laci menu ---------- */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-ink/45" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Logo size={32} />
              <span className="flex-1 leading-tight">
                <span className="block font-extrabold">Smart Bakery</span>
                <span className="block text-xs text-muted">Produksi & Digital BOM</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-sunken">
                <X className="size-6" />
              </button>
            </div>
            <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto p-2">
              <ul className="flex flex-col gap-1">
                {items.map((it) => {
                  const active = isActive(path, it.href);
                  const Icon = ICONS[it.icon];
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cx("flex h-12 items-center gap-3 rounded-xl px-3 text-[16px] font-semibold", active ? "bg-brand-soft text-ink" : "text-ink-2 hover:bg-sunken")}
                      >
                        <Icon className={cx("size-5", active ? "text-brand" : "text-muted")} />
                        <span className="flex-1">{it.label}</span>
                        <Badge n={it.badge} alert={it.alert} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex items-center gap-3 border-t border-line p-3">
              <Avatar name={user.name} color={user.color} size={36} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-bold">{user.name}</span>
                <span className="block text-sm text-muted">{user.role}</span>
              </span>
              <form action={logout}>
                <button type="submit" className="flex h-11 items-center gap-2 rounded-xl px-3 font-semibold text-muted hover:bg-sunken hover:text-ink">
                  <LogOut className="size-5" /> Keluar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
