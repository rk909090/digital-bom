"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { events } from "@/lib/events";

export async function resolveException(input: { id: number; decision: "disetujui" | "investigasi"; note?: string }) {
  return safe(async () => {
    const user = await actionUser("verifikasi");
    const ex = await db.query.exceptions.findFirst({ where: eq(t.exceptions.id, input.id) });
    if (!ex) throw new ActionError("Data penyimpangan tidak ditemukan.");
    if (ex.status === "disetujui") throw new ActionError("Penyimpangan ini sudah disetujui.");
    if (input.decision === "investigasi" && !input.note?.trim()) throw new ActionError("Tulis catatan apa yang perlu diinvestigasi.");
    await db
      .update(t.exceptions)
      .set({ status: input.decision, resolvedBy: user.id, resolvedAt: nowISO(), resolutionNote: input.note?.trim().slice(0, 300) || null })
      .where(eq(t.exceptions.id, ex.id));
    await logActivity(db, user.id, `exception_${input.decision}`, ex.code, input.note);
    revalidatePath("/", "layout");
    return { code: ex.code };
  });
}

/** Syarat tutup batch (dipakai juga untuk tampilan). */
export async function closeBatch(code: string) {
  return safe(async () => {
    const user = await actionUser("verifikasi");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, code), with: { materials: true, output: true, handover: true, exceptions: true } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    if (b.status === "ditutup") throw new ActionError("Batch sudah ditutup.");
    if (b.materials.some((m) => m.actualQty == null)) throw new ActionError("Masih ada bahan yang belum ditimbang.");
    if (!b.output) throw new ActionError("Hasil produksi belum dicatat.");
    if (!b.handover) throw new ActionError("Produk jadi batch ini belum dikirim (Pengiriman FG).");
    const open = b.exceptions.filter((e) => e.status !== "disetujui").length;
    if (open) throw new ActionError(`Masih ada ${open} penyimpangan yang belum disetujui.`);
    await db.update(t.batches).set({ status: "ditutup", closedAt: nowISO(), closedBy: user.id }).where(eq(t.batches.id, b.id));
    await logActivity(db, user.id, "tutup_batch", b.code);
    await events.batchClosed(b.code);
    revalidatePath("/", "layout");
    return { code: b.code };
  });
}
