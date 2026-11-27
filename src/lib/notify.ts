import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { dispatchOutbox, enqueueChannels } from "./channels";

export type Notice = {
  event: string;
  roles: string[];
  severity: "info" | "warn" | "bad" | "good";
  title: string;
  body: string;
  link?: string;
  /** Jika diisi, notifikasi dengan kunci sama tidak dibuat dua kali (untuk pengingat agent). */
  dedupeKey?: string;
};

/**
 * Buat notifikasi di aplikasi + antrekan ke Telegram/WhatsApp.
 * Tidak pernah melempar error: kegagalan notifikasi tidak boleh menggagalkan transaksi produksi.
 */
export async function notify(n: Notice): Promise<boolean> {
  try {
    if (n.dedupeKey && (await db.query.notifications.findFirst({ where: eq(t.notifications.dedupeKey, n.dedupeKey) }))) return false;
    const [row] = await db
      .insert(t.notifications)
      .values({ createdAt: new Date().toISOString(), roles: `,${n.roles.join(",")},`, severity: n.severity, title: n.title, body: n.body, link: n.link ?? null, event: n.event, dedupeKey: n.dedupeKey ?? null })
      .returning();
    const appUrl = process.env.APP_URL ?? "";
    const text = `${icon(n.severity)} ${n.title}\n${n.body}${n.link && appUrl ? `\n${appUrl}${n.link}` : ""}`;
    if (await enqueueChannels(row.id, n.roles, text)) setTimeout(() => dispatchOutbox().catch((e) => console.error("[notify] kirim", e)), 0);
    return true;
  } catch (e) {
    console.error("[notify] gagal", e);
    return false;
  }
}

function icon(s: Notice["severity"]) {
  return { info: "ℹ️", warn: "⚠️", bad: "🔴", good: "✅" }[s];
}
