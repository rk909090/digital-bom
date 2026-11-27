"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, ClipboardList, Handshake, Home, PackageCheck, Plug, Scale, Settings, ShieldCheck, Warehouse } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = { home: Home, plan: ClipboardList, warehouse: Warehouse, scale: Scale, output: PackageCheck, handover: Handshake, verify: ShieldCheck, report: BarChart3, master: BookOpen, integration: Plug, settings: Settings };

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; alert?: boolean };

export function NavTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu utama" className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4 [scrollbar-width:none]">
      <ul className="flex gap-1 pt-2">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          const Icon = ICONS[it.icon];
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex h-12 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 text-[15px] font-semibold transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon className={cx("size-5", active && "text-brand")} />
                {it.label}
                {!!it.badge && (
                  <span className={cx("min-w-5 rounded-full px-1.5 text-center text-xs font-bold leading-5 tnum", it.alert ? "bg-bad text-white" : "bg-sunken text-ink-2 border border-line")}>{it.badge}</span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
