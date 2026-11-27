"use server";

import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { nextCode } from "@/lib/codes";
import { events } from "@/lib/events";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { productsWithBom, reservedByMaterial, computeRequirement, listMaterials } from "@/lib/queries";
import { splitBatches, stdQty } from "@/lib/rules";
import { yymmdd } from "@/lib/format";

export async function createPlan(input: { productId: number; qty: number; date: string }) {
  return safe(async () => {
    const user = await actionUser("rencana");
    const qty = Math.floor(Number(input.qty));
    if (!Number.isFinite(qty) || qty < 1) throw new ActionError("Isi jumlah produksi minimal 1 pcs.");
    if (qty > 100000) throw new ActionError("Jumlah terlalu besar. Maksimal 100.000 pcs per rencana.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ActionError("Tanggal produksi tidak valid.");

    const product = (await productsWithBom()).find((p) => p.id === input.productId);
    if (!product) throw new ActionError("Produk tidak ditemukan atau belum punya resep (BOM).");

    const [materials, reserved] = await Promise.all([listMaterials(), reservedByMaterial()]);
    const req = computeRequirement(product, qty, materials, reserved);
    const sizes = splitBatches(qty, product.bom.baseQty);
    const d = yymmdd(input.date);
    const now = nowISO();

    const result = await db.transaction(async (tx) => {
      const orderCode = await nextCode(tx, t.productionOrders, t.productionOrders.code, `PRD-${d}-`);
      const [order] = await tx
        .insert(t.productionOrders)
        .values({ code: orderCode, date: input.date, productId: product.id, qty, bomVersionId: product.bom.id, createdBy: user.id, createdAt: now })
        .returning();

      const batchCodes: string[] = [];
      for (let i = 0; i < sizes.length; i++) {
        const code = await nextCode(tx, t.batches, t.batches.code, `${product.code}-${d}-`);
        const [b] = await tx.insert(t.batches).values({ code, orderId: order.id, productId: product.id, date: input.date, target: sizes[i], status: "menunggu", createdAt: now }).returning();
        await tx.insert(t.batchMaterials).values(
          product.bom.lines.map((l) => ({ batchId: b.id, materialId: l.materialId, stdQty: stdQty(l.qty, sizes[i], product.bom.baseQty), tolerancePct: l.tolerancePct, sort: l.sort })),
        );
        batchCodes.push(code);
      }

      const reqCode = await nextCode(tx, t.materialRequests, t.materialRequests.code, `RQ-${d}-`);
      const [rq] = await tx.insert(t.materialRequests).values({ code: reqCode, orderId: order.id, status: "baru", createdAt: now, updatedAt: now }).returning();
      const lines = req.filter((r) => r.tracked).map((r) => ({ requestId: rq.id, materialId: r.materialId, qty: r.need, shortage: r.shortage }));
      if (lines.length) await tx.insert(t.materialRequestLines).values(lines);

      await logActivity(tx, user.id, "buat_rencana", orderCode, `${product.name} ${qty} pcs, ${sizes.length} batch`);
      return { orderCode, reqCode, batchCodes, shortages: req.filter((r) => r.shortage > 0).length };
    });

    await events.planCreated({
      orderCode: result.orderCode, reqCode: result.reqCode, product: product.name, qty, batches: sizes.length,
      shortages: req.filter((r) => r.shortage > 0).map((r) => ({ name: materials.find((m) => m.id === r.materialId)!.name, qty: r.shortage })),
    });
    revalidatePath("/", "layout");
    return result;
  });
}
