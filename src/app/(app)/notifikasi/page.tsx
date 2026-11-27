import Link from "next/link";
import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { notificationsFor } from "@/lib/notif-queries";
import { dateTime, nowMs } from "@/lib/format";
import { Card, Empty, PageHeader, cx } from "@/components/ui";
import { SevIcon, ago } from "@/components/notif-item";
import { MarkAllButton } from "./mark-all";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function NotifPage() {
  const user = await requireUser("notifikasi");
  const items = await notificationsFor(user, 100);
  const unread = items.filter((n) => !n.read).length;
  const now = nowMs();
  return (
    <>
      <PageHeader
        title="Notifikasi"
        subtitle="Pemberitahuan dari Digital Agent: tugas baru, penyimpangan, pengingat, dan laporan harian."
        actions={unread ? <MarkAllButton count={unread} /> : undefined}
      />
      {items.length === 0 ? (
        <Empty title="Belum ada notifikasi" icon={<BellOff />}>Notifikasi muncul saat ada tugas atau penyimpangan yang perlu Anda tangani.</Empty>
      ) : (
        <Card className="divide-y divide-line">
          {items.map((n) => {
            const inner = (
              <>
                <SevIcon s={n.severity} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className={cx("text-[16px] leading-snug", n.read ? "font-semibold" : "font-bold")}>{n.title}</p>
                    {!n.read && <span className="rounded-full bg-brand px-2 text-xs font-bold leading-5 text-white">Baru</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[15px] text-ink-2">{n.body}</p>
                  <p className="mt-1 text-sm text-muted" title={dateTime(n.createdAt)}>{ago(n.createdAt, now)}</p>
                </div>
              </>
            );
            const cls = cx("flex gap-4 px-5 py-4", !n.read && "bg-brand-soft/40");
            return n.link ? (
              <Link key={n.id} href={n.link} className={cx(cls, "hover:bg-sunken")}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
