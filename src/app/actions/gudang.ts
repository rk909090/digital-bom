"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { events } from "@/lib/events";

export async function advanceRequest(requestId: number) {
  return safe(async () => {
    const user = await actionUser("gudang");
    const rq = await db.query.materialRequests.findFirst({ where: eq(t.materialRequests.id, requestId) });
    if (!rq) throw new ActionError("Permintaan tidak ditemukan.");
    const next = rq.status === "baru" ? "disiapkan" : rq.status === "disiapkan" ? "diserahkan" : null;
    if (!next) throw new ActionError("Permintaan ini sudah selesai.");
    await db.update(t.materialRequests).set({ status: next, updatedAt: nowISO(), handledBy: user.id }).where(eq(t.materialRequests.id, requestId));
    await logActivity(db, user.id, `permintaan_${next}`, rq.code);
    const order = await db.query.productionOrders.findFirst({ where: eq(t.productionOrders.id, rq.orderId), with: { product: true } });
    await events.requestAdvanced({ code: rq.code, status: next, product: order?.product.name ?? "" });
    revalidatePath("/", "layout");
    return { code: rq.code, status: next };
  });
}

export async function receiveStock(input: { materialId: number; qty: number; note?: string }) {
  return safe(async () => {
    const user = await actionUser("gudang");
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new ActionError("Isi jumlah barang masuk lebih dari 0.");
    if (qty > 100000) throw new ActionError("Jumlah terlalu besar.");
    const m = await db.query.materials.findFirst({ where: eq(t.materials.id, input.materialId) });
    if (!m) throw new ActionError("Bahan tidak ditemukan.");
    const moveId = await db.transaction(async (tx) => {
      await tx.update(t.materials).set({ stock: sql`${t.materials.stock} + ${qty}` }).where(eq(t.materials.id, m.id));
      const [mv] = await tx.insert(t.stockMoves).values({ materialId: m.id, qty, type: "masuk", ref: "Barang masuk", note: input.note?.slice(0, 200) || null, userId: user.id, createdAt: nowISO() }).returning();
      await logActivity(tx, user.id, "barang_masuk", m.code, `${qty} kg`);
      return mv.id;
    });
    await events.stockReceived({ code: m.code, name: m.name, qty, note: input.note, moveId });
    revalidatePath("/", "layout");
    return { name: m.name };
  });
}
