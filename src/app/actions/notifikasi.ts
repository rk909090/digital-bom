"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, safe } from "@/lib/auth";
import { notificationsFor } from "@/lib/notif-queries";

/** Tandai notifikasi dibaca. ids kosong = semua notifikasi yang terlihat oleh pengguna. */
export async function markRead(ids?: number[]) {
  return safe(async () => {
    const user = await actionUser("notifikasi");
    const visible = (await notificationsFor(user, 500)).filter((n) => !n.read);
    const target = ids?.length ? visible.filter((n) => ids.includes(n.id)) : visible;
    if (!target.length) return { count: 0 };
    const already = await db
      .select({ id: t.notificationReads.notificationId })
      .from(t.notificationReads)
      .where(and(eq(t.notificationReads.userId, user.id), inArray(t.notificationReads.notificationId, target.map((n) => n.id))));
    const skip = new Set(already.map((a) => a.id));
    const rows = target.filter((n) => !skip.has(n.id)).map((n) => ({ notificationId: n.id, userId: user.id, readAt: new Date().toISOString() }));
    if (rows.length) await db.insert(t.notificationReads).values(rows);
    revalidatePath("/", "layout");
    return { count: rows.length };
  });
}
