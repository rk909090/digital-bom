import { requireUser } from "@/lib/auth";
import { navCounts } from "@/lib/queries";
import { can, ROLE_LABEL } from "@/lib/access";
import { AppNav, type NavItem } from "./nav-tabs";
import { NotifBell } from "./notif-bell";
import { notificationsFor, unreadCount } from "@/lib/notif-queries";
import { nowMs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const n = await navCounts();
  const items: NavItem[] = [
    { href: "/", label: "Beranda", short: "Beranda", icon: "home" },
    can(user.role, "rencana") && { href: "/rencana", label: "Rencana", short: "Rencana", icon: "plan" },
    can(user.role, "gudang") && { href: "/gudang", label: "Gudang", short: "Gudang", icon: "warehouse", badge: n.gudang },
    can(user.role, "timbang") && { href: "/timbang", label: "Timbang Bahan", short: "Timbang", icon: "scale", badge: n.timbang },
    can(user.role, "output") && { href: "/output", label: "Hasil Produksi", short: "Hasil", icon: "output", badge: n.output },
    can(user.role, "serahTerima") && { href: "/serah-terima", label: "Serah Terima", short: "Serah", icon: "handover", badge: n.serahTerima },
    can(user.role, "verifikasi") && { href: "/verifikasi", label: "Verifikasi", short: "Verifikasi", icon: "verify", badge: n.verifikasi + n.tutup, alert: n.verifikasi > 0 },
    can(user.role, "laporan") && { href: "/laporan", label: "Laporan", short: "Laporan", icon: "report" },
    can(user.role, "master") && { href: "/master", label: "Resep & Bahan", short: "Resep", icon: "master" },
    can(user.role, "integrasi") && { href: "/integrasi", label: "Integrasi ERP", short: "ERP", icon: "integration" },
    can(user.role, "pengaturan") && { href: "/pengaturan", label: "Pengaturan", short: "Atur", icon: "settings" },
  ].filter(Boolean) as NavItem[];
  const [unread, latest] = await Promise.all([unreadCount(user), notificationsFor(user, 8)]);
  const now = nowMs();

  return (
    <div className="min-h-dvh lg:flex">
      <AppNav
        items={items}
        user={{ name: user.name, color: user.color, role: ROLE_LABEL[user.role] }}
        bell={<NotifBell count={unread} items={latest} now={now} placement="side" />}
        mobileBell={<NotifBell count={unread} items={latest} now={now} />}
      />
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:py-6">{children}</main>
    </div>
  );
}
