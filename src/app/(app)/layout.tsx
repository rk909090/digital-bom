import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { navCounts } from "@/lib/queries";
import { can, ROLE_LABEL } from "@/lib/access";
import { logout } from "../actions/auth";
import { Logo, Avatar } from "@/components/logo";
import { NavTabs, type NavItem } from "./nav-tabs";
import { NotifBell } from "./notif-bell";
import { notificationsFor, unreadCount } from "@/lib/notif-queries";
import { nowMs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const n = await navCounts();
  const items: NavItem[] = [
    { href: "/", label: "Beranda", icon: "home" },
    can(user.role, "rencana") && { href: "/rencana", label: "Rencana", icon: "plan" },
    can(user.role, "gudang") && { href: "/gudang", label: "Gudang", icon: "warehouse", badge: n.gudang },
    can(user.role, "timbang") && { href: "/timbang", label: "Timbang Bahan", icon: "scale", badge: n.timbang },
    can(user.role, "output") && { href: "/output", label: "Hasil Produksi", icon: "output", badge: n.output },
    can(user.role, "serahTerima") && { href: "/serah-terima", label: "Serah Terima", icon: "handover", badge: n.serahTerima },
    can(user.role, "verifikasi") && { href: "/verifikasi", label: "Verifikasi", icon: "verify", badge: n.verifikasi + n.tutup, alert: n.verifikasi > 0 },
    can(user.role, "laporan") && { href: "/laporan", label: "Laporan", icon: "report" },
    can(user.role, "master") && { href: "/master", label: "Resep & Bahan", icon: "master" },
    can(user.role, "integrasi") && { href: "/integrasi", label: "Integrasi ERP", icon: "integration" },
    can(user.role, "pengaturan") && { href: "/pengaturan", label: "Pengaturan", icon: "settings" },
  ].filter(Boolean) as NavItem[];
  const [unread, latest] = await Promise.all([unreadCount(user), notificationsFor(user, 8)]);
  const now = nowMs();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Logo size={38} />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate font-extrabold leading-tight">Smart Bakery</span>
              <span className="block text-xs text-muted">Produksi & Digital BOM</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NotifBell count={unread} items={latest} now={now} />
            <div className="flex items-center gap-2.5 rounded-full border border-line py-1 pl-1 pr-3">
              <Avatar name={user.name} color={user.color} size={30} />
              <span className="leading-tight">
                <span className="block text-sm font-bold">{user.name}</span>
                <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
              </span>
            </div>
            <form action={logout}>
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink" aria-label="Keluar">
                <LogOut className="size-4.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </div>
        <NavTabs items={items} />
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
