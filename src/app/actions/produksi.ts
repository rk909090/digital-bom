"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { events } from "@/lib/events";
import { REJECT_REASONS } from "@/db/schema";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { goodQty } from "@/lib/rules";
import { getDestinations } from "@/lib/settings";

const int = (n: unknown) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
};

export async function saveOutput(input: {
  batchCode: string;
  trays: number;
  loose: number;
  rejects: Record<string, number>;
  workers: number;
  hours: number;
  camera?: { good: number; reject: number; confidence: string } | null;
}) {
  return safe(async () => {
    const user = await actionUser("output");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { product: true } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    if (b.status !== "produksi") throw new ActionError("Hasil batch ini sudah dicatat, atau adonannya belum dikeluarkan dari freezer.");
    const trays = int(input.trays);
    const loose = int(input.loose);
    if (trays == null || loose == null) throw new ActionError("Jumlah tray atau satuan tidak valid.");
    const rejects = REJECT_REASONS.map((r) => ({ reason: r.key, qty: int(input.rejects?.[r.key] ?? 0) ?? -1 }));
    if (rejects.some((r) => r.qty < 0)) throw new ActionError("Jumlah reject tidak valid.");
    const workers = Math.floor(Number(input.workers));
    const hours = Math.round(Number(input.hours) * 100) / 100;
    if (!(workers >= 1 && workers <= 200)) throw new ActionError("Isi jumlah orang yang bekerja (minimal 1).");
    if (!(hours > 0 && hours <= 24)) throw new ActionError("Isi lama kerja dalam jam (lebih dari 0, maksimal 24).");
    const good = goodQty(trays, b.product.traySize, loose);
    const rej = rejects.reduce((a, r) => a + r.qty, 0);
    if (good + rej === 0) throw new ActionError("Isi jumlah produk bagus atau reject.");
    const now = nowISO();
    await db.transaction(async (tx) => {
      const cam = input.camera;
      await tx.insert(t.outputs).values({ batchId: b.id, trays, loose, workers, hours, source: cam ? "kamera" : "manual", recordedBy: user.id, recordedAt: now });
      const rows = rejects.filter((r) => r.qty > 0).map((r) => ({ batchId: b.id, reason: r.reason, qty: r.qty }));
      if (rows.length) await tx.insert(t.outputRejects).values(rows);
      await tx.update(t.batches).set({ status: "output" }).where(eq(t.batches.id, b.id));
      await logActivity(
        tx, user.id, "catat_output", b.code,
        `${good} bagus, ${rej} reject, ${workers} orang × ${hours} jam${cam ? ` (kamera AI: ${Number(cam.good) || 0} bagus, ${Number(cam.reject) || 0} reject, keyakinan ${String(cam.confidence).slice(0, 10)}${Number(cam.good) !== good ? "; dikoreksi operator" : ""})` : ""}`,
      );
    });
    await events.outputRecorded({ batchCode: b.code, product: b.product.name, good, reject: rej });
    revalidatePath("/", "layout");
    return { good, reject: rej };
  });
}

/** Pengiriman FG oleh Packing FG ke Gudang FG atau outlet. Disetujui sistem (keputusan klien): tanpa hitung ulang/tanda tangan. */
export async function shipFinishedGoods(input: { batchCode: string; destination: string }) {
  return safe(async () => {
    const user = await actionUser("pengiriman");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { product: true, output: true } });
    if (!b || !b.output) throw new ActionError("Batch tidak ditemukan atau hasilnya belum dicatat.");
    if (b.status !== "output") throw new ActionError("Batch ini sudah dikirim sebelumnya.");
    const destinations = await getDestinations();
    if (!destinations.includes(input.destination)) throw new ActionError("Pilih tujuan pengiriman dari daftar.");
    const qty = goodQty(b.output.trays, b.product.traySize, b.output.loose);
    const now = nowISO();
    const code = `KRM-${b.code}`;
    await db.transaction(async (tx) => {
      await tx.insert(t.handovers).values({ batchId: b.id, code, destination: input.destination, qtySent: qty, qtyReceived: qty, receivedBy: user.id, receivedAt: now, note: "Disetujui sistem" });
      await tx.update(t.batches).set({ status: "diterima" }).where(eq(t.batches.id, b.id));
      await logActivity(tx, user.id, "kirim_fg", code, `${qty} pcs ke ${input.destination}`);
    });
    await events.shipped(b.code);
    revalidatePath("/", "layout");
    return { code, qty, destination: input.destination };
  });
}
