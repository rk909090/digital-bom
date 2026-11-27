import "server-only";
import { and, desc, inArray, like, sql, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { SessionUser } from "./auth";

const forRole = (u: SessionUser) => (u.role === "admin" ? undefined : like(t.notifications.roles, `%,${u.role},%`));

export async function notificationsFor(u: SessionUser, limit = 50) {
  const rows = await db.query.notifications.findMany({ where: forRole(u), orderBy: desc(t.notifications.id), limit });
  if (!rows.length) return [];
  const reads = await db
    .select({ id: t.notificationReads.notificationId })
    .from(t.notificationReads)
    .where(and(eq(t.notificationReads.userId, u.id), inArray(t.notificationReads.notificationId, rows.map((r) => r.id))));
  const seen = new Set(reads.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, severity: r.severity, title: r.title, body: r.body, link: r.link, event: r.event, read: seen.has(r.id) }));
}
export type NotifItem = Awaited<ReturnType<typeof notificationsFor>>[number];

export async function unreadCount(u: SessionUser) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.notifications)
    .where(
      and(
        forRole(u),
        sql`not exists (select 1 from ${t.notificationReads} r where r.notification_id = ${t.notifications.id} and r.user_id = ${u.id})`,
      ),
    );
  return Number(row?.n ?? 0);
}
