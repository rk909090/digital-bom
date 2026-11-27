"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { nextCode } from "@/lib/codes";
import { events } from "@/lib/events";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { isOutOfTolerance } from "@/lib/rules";
import { todayISO, yymmdd } from "@/lib/format";
import { parseVoice } from "@/lib/voice-parse";
import { aiParseVoice } from "@/lib/ai";

export type VoiceResult = { engine: "ai" | "lokal"; items: { lineId: number | null; kg: number | null; raw: string; error?: string }[] };

/** Urai kalimat operator (hasil pengenal suara atau diketik) untuk batch ini. Tidak menyimpan apa pun. */
export async function parseVoiceInput(input: { batchCode: string; transcript: string; activeLineId: number | null }) {
  return safe<VoiceResult>(async () => {
    await actionUser("timbang");
    const text = input.transcript.trim().slice(0, 500);
    if (!text) throw new ActionError("Belum ada ucapan yang terdengar.");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { materials: { with: { material: true } } } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    const open = b.materials.filter((m) => m.actualQty == null);
    const lines = open.map((m) => ({ id: m.id, code: m.material.code, name: m.material.name, std: m.stdQty }));
    const active = open.some((m) => m.id === input.activeLineId) ? input.activeLineId : null;
    const local = parseVoice(text, lines, active);
    // AI dipakai untuk kalimat yang tidak terurai sempurna secara lokal
    if (local.length && local.every((i) => !i.error)) return { engine: "lokal", items: local };
    const ai = await aiParseVoice(text, lines, active);
    if (ai?.length) return { engine: "ai", items: ai.map((i) => ({ lineId: i.lineId, kg: i.kg, raw: text })) };
    if (!local.length) return { engine: "lokal", items: [{ lineId: null, kg: null, raw: text, error: "Tidak ada bahan batch ini yang disebut." }] };
    return { engine: "lokal", items: local };
  });
}

export async function saveWeighing(input: { batchMaterialId: number; actual: number; source: "timbangan" | "keypad" | "suara"; reason?: string }) {
  return safe(async () => {
    const user = await actionUser("timbang");
    if (!["timbangan", "keypad", "suara"].includes(input.source)) throw new ActionError("Sumber input tidak valid.");
    const actual = Math.round(Number(input.actual) * 1000) / 1000;
    const bm = await db.query.batchMaterials.findFirst({ where: eq(t.batchMaterials.id, input.batchMaterialId), with: { batch: true, material: true } });
    if (!bm) throw new ActionError("Data bahan tidak ditemukan.");
    if (!["menunggu", "ditimbang"].includes(bm.batch.status)) throw new ActionError("Batch ini sudah tidak dalam tahap penimbangan.");
    if (bm.actualQty != null) throw new ActionError(`${bm.material.name} sudah ditimbang sebelumnya.`);
    if (!Number.isFinite(actual) || actual <= 0) throw new ActionError("Berat harus lebih dari 0.");
    if (actual > bm.stdQty * 5 + 1) throw new ActionError("Berat terlalu jauh dari target. Periksa lagi angkanya.");
    const out = isOutOfTolerance(actual, bm.stdQty, bm.tolerancePct);
    if (out && !input.reason) throw new ActionError("Berat di luar batas. Pilih alasan sebelum menyimpan.");
    const now = nowISO();

    const res = await db.transaction(async (tx) => {
      await tx
        .update(t.batchMaterials)
        .set({ actualQty: actual, source: input.source, weighedBy: user.id, weighedAt: now, outOfTolerance: out, reason: out ? input.reason!.slice(0, 120) : null })
        .where(eq(t.batchMaterials.id, bm.id));
      if (bm.material.tracked) {
        await tx.update(t.materials).set({ stock: sql`${t.materials.stock} - ${actual}` }).where(eq(t.materials.id, bm.materialId));
        await tx.insert(t.stockMoves).values({ materialId: bm.materialId, qty: -actual, type: "pakai", ref: bm.batch.code, userId: user.id, createdAt: now });
      }
      let exCode: string | null = null;
      if (out) {
        const d = yymmdd(todayISO());
        exCode = await nextCode(tx, t.exceptions, t.exceptions.code, `EX-${d}-`);
        await tx.insert(t.exceptions).values({ code: exCode, type: "bahan", batchId: bm.batchId, materialId: bm.materialId, expected: bm.stdQty, actual, reason: input.reason, status: "terbuka", createdAt: now, createdBy: user.id });
      }
      const rows = await tx.select({ a: t.batchMaterials.actualQty }).from(t.batchMaterials).where(eq(t.batchMaterials.batchId, bm.batchId));
      const allDone = rows.every((r) => r.a != null);
      await tx.update(t.batches).set({ status: allDone ? "adonan" : "ditimbang" }).where(eq(t.batches.id, bm.batchId));
      await logActivity(tx, user.id, "timbang", bm.batch.code, `${bm.material.name} ${actual} kg (${input.source})${out ? ` → ${exCode}` : ""}`);
      return { allDone, exCode };
    });

    if (res.exCode) {
      const p = await db.query.products.findFirst({ where: eq(t.products.id, bm.batch.productId) });
      await events.weighOut({ batchCode: bm.batch.code, product: p?.name ?? "", material: bm.material.name, std: bm.stdQty, actual, reason: input.reason ?? "-", exCode: res.exCode });
    }
    if (res.allDone) await events.batchWeighed(bm.batchId);
    revalidatePath("/", "layout");
    return res;
  });
}
