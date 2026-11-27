"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { events } from "@/lib/events";

/** Gudang WIP: adonan hasil penimbangan masuk freezer (dicatat beratnya). */
export async function freezerIn(input: { batchCode: string; doughKg: number }) {
  return safe(async () => {
    const user = await actionUser("wip");
    const kg = Math.round(Number(input.doughKg) * 100) / 100;
    if (!(kg > 0 && kg < 100000)) throw new ActionError("Isi berat adonan lebih dari 0 kg.");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, input.batchCode), with: { product: true } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    if (b.status !== "adonan") throw new ActionError("Adonan batch ini belum siap atau sudah masuk freezer.");
    await db.update(t.batches).set({ status: "wip", doughKg: kg, wipInAt: nowISO(), wipInBy: user.id }).where(eq(t.batches.id, b.id));
    await logActivity(db, user.id, "wip_masuk", b.code, `${kg} kg`);
    await events.wipIn(b.code);
    revalidatePath("/", "layout");
    return { code: b.code, kg };
  });
}

/** Gudang WIP: adonan keluar freezer untuk diproduksi (seluruh adonan batch). */
export async function freezerOut(batchCode: string) {
  return safe(async () => {
    const user = await actionUser("wip");
    const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true } });
    if (!b) throw new ActionError("Batch tidak ditemukan.");
    if (b.status !== "wip") throw new ActionError("Adonan batch ini tidak sedang di freezer.");
    await db.update(t.batches).set({ status: "produksi", wipOutAt: nowISO(), wipOutBy: user.id }).where(eq(t.batches.id, b.id));
    await logActivity(db, user.id, "wip_keluar", b.code, `${b.doughKg ?? "-"} kg`);
    await events.wipOut(b.code);
    revalidatePath("/", "layout");
    return { code: b.code };
  });
}
