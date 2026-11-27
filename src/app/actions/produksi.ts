"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { nextCode } from "@/lib/codes";
import { events } from "@/lib/events";
import { REJECT_REASONS } from "@/db/schema";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { goodQty } from "@/lib/rules";
import { todayISO, yymmdd } from "@/lib/format";

const int = (n: unknown) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
};

export async function saveOutput(input: { batchCode: string; trays: number; loose: number; rejects: Record<string, number>; camera?: { good: number; reject: number; confidence: string } | null }) {
  return safe(async () => {
    const user = await actionUser("output");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { product: true } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    if (b.status !== "produksi") throw new ActionError("Hasil batch ini sudah dicatat atau bahannya belum selesai ditimbang.");
    const trays = int(input.trays);
    const loose = int(input.loose);
    if (trays == null || loose == null) throw new ActionError("Jumlah tray atau satuan tidak valid.");
    const rejects = REJECT_REASONS.map((r) => ({ reason: r.key, qty: int(input.rejects?.[r.key] ?? 0) ?? -1 }));
    if (rejects.some((r) => r.qty < 0)) throw new ActionError("Jumlah reject tidak valid.");
    const good = goodQty(trays, b.product.traySize, loose);
    const rej = rejects.reduce((a, r) => a + r.qty, 0);
    if (good + rej === 0) throw new ActionError("Isi jumlah produk bagus atau reject.");
    const now = nowISO();
    await db.transaction(async (tx) => {
      const cam = input.camera;
      await tx.insert(t.outputs).values({ batchId: b.id, trays, loose, source: cam ? "kamera" : "manual", recordedBy: user.id, recordedAt: now });
      const rows = rejects.filter((r) => r.qty > 0).map((r) => ({ batchId: b.id, reason: r.reason, qty: r.qty }));
      if (rows.length) await tx.insert(t.outputRejects).values(rows);
      await tx.update(t.batches).set({ status: "output" }).where(eq(t.batches.id, b.id));
      await logActivity(
        tx, user.id, "catat_output", b.code,
        `${good} bagus, ${rej} reject${cam ? ` (kamera AI: ${Number(cam.good) || 0} bagus, ${Number(cam.reject) || 0} reject, keyakinan ${String(cam.confidence).slice(0, 10)}${Number(cam.good) !== good ? "; dikoreksi operator" : ""})` : ""}`,
      );
    });
    await events.outputRecorded({ batchCode: b.code, product: b.product.name, good, reject: rej });
    revalidatePath("/", "layout");
    return { good, reject: rej };
  });
}

export async function confirmHandover(input: { batchCode: string; received: number; reason?: string }) {
  return safe(async () => {
    const user = await actionUser("serahTerima");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { product: true, output: true } });
    if (!b || !b.output) throw new ActionError("Batch tidak ditemukan atau hasilnya belum dicatat.");
    if (b.status !== "output") throw new ActionError("Batch ini sudah diterima sebelumnya.");
    const received = int(input.received);
    if (received == null) throw new ActionError("Jumlah diterima tidak valid.");
    const sent = goodQty(b.output.trays, b.product.traySize, b.output.loose);
    const diff = received !== sent;
    if (diff && !input.reason) throw new ActionError("Jumlah berbeda. Pilih alasannya dulu.");
    const now = nowISO();
    const code = `ST-${b.code}`;
    const ex = await db.transaction(async (tx) => {
      await tx.insert(t.handovers).values({ batchId: b.id, code, qtySent: sent, qtyReceived: received, receivedBy: user.id, receivedAt: now, note: diff ? input.reason : null });
      let exCode: string | null = null;
      if (diff) {
        const d = yymmdd(todayISO());
        exCode = await nextCode(tx, t.exceptions, t.exceptions.code, `EX-${d}-`);
        await tx.insert(t.exceptions).values({ code: exCode, type: "serah_terima", batchId: b.id, expected: sent, actual: received, reason: input.reason, status: "terbuka", createdAt: now, createdBy: user.id });
      }
      await tx.update(t.batches).set({ status: "diterima" }).where(eq(t.batches.id, b.id));
      await logActivity(tx, user.id, "serah_terima", code, `dikirim ${sent}, diterima ${received}`);
      return exCode;
    });
    await events.handover(b.code);
    revalidatePath("/", "layout");
    return { code, exCode: ex };
  });
}
