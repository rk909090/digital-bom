"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity, nowISO } from "@/lib/log";
import { seedDatabase } from "@/db/seed-data";

type LineIn = { materialId: number; qty: number; tolerancePct: number };

export async function saveBom(input: { productId: number; baseQty: number; traySize: number; note: string; lines: LineIn[] }) {
  return safe(async () => {
    const user = await actionUser("master");
    const base = Math.floor(Number(input.baseQty));
    const tray = Math.floor(Number(input.traySize));
    if (!(base >= 1 && base <= 100000)) throw new ActionError("Jumlah per batch harus antara 1 dan 100.000 pcs.");
    if (!(tray >= 1 && tray <= 1000)) throw new ActionError("Isi per tray harus antara 1 dan 1.000 pcs.");
    if (!input.lines.length) throw new ActionError("Resep harus berisi minimal 1 bahan.");
    const ids = new Set<number>();
    for (const l of input.lines) {
      if (ids.has(l.materialId)) throw new ActionError("Ada bahan yang dimasukkan dua kali.");
      ids.add(l.materialId);
      if (!(Number(l.qty) > 0)) throw new ActionError("Jumlah setiap bahan harus lebih dari 0.");
      if (!(Number(l.tolerancePct) >= 0 && Number(l.tolerancePct) <= 50)) throw new ActionError("Toleransi harus 0–50%.");
    }
    const product = await db.query.products.findFirst({ where: eq(t.products.id, input.productId) });
    if (!product) throw new ActionError("Produk tidak ditemukan.");
    const last = await db.query.bomVersions.findFirst({ where: eq(t.bomVersions.productId, product.id), orderBy: desc(t.bomVersions.version) });
    const version = (last?.version ?? 0) + 1;
    await db.transaction(async (tx) => {
      await tx.update(t.bomVersions).set({ active: false }).where(and(eq(t.bomVersions.productId, product.id), eq(t.bomVersions.active, true)));
      const [v] = await tx.insert(t.bomVersions).values({ productId: product.id, version, baseQty: base, note: input.note?.slice(0, 200) || null, active: true, createdAt: nowISO(), createdBy: user.id }).returning();
      await tx.insert(t.bomLines).values(input.lines.map((l, i) => ({ bomVersionId: v.id, materialId: l.materialId, qty: Math.round(Number(l.qty) * 10000) / 10000, tolerancePct: Number(l.tolerancePct), sort: i })));
      if (tray !== product.traySize) await tx.update(t.products).set({ traySize: tray }).where(eq(t.products.id, product.id));
      await logActivity(tx, user.id, "simpan_resep", product.code, `versi ${version}`);
    });
    revalidatePath("/", "layout");
    return { version };
  });
}

export async function createProduct(input: { code: string; name: string; traySize: number }) {
  return safe(async () => {
    const user = await actionUser("master");
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!/^[A-Z]{2,5}$/.test(code)) throw new ActionError("Kode produk 2–5 huruf, mis. RKJ.");
    if (name.length < 3) throw new ActionError("Nama produk minimal 3 huruf.");
    const tray = Math.floor(Number(input.traySize));
    if (!(tray >= 1 && tray <= 1000)) throw new ActionError("Isi per tray harus antara 1 dan 1.000 pcs.");
    if (await db.query.products.findFirst({ where: eq(t.products.code, code) })) throw new ActionError(`Kode ${code} sudah dipakai.`);
    await db.insert(t.products).values({ code, name, traySize: tray, image: null });
    await logActivity(db, user.id, "buat_produk", code, name);
    revalidatePath("/", "layout");
    return { code };
  });
}

export async function saveMaterial(input: { id?: number; code?: string; name: string; minStock: number; tracked: boolean }) {
  return safe(async () => {
    const user = await actionUser("master");
    const name = input.name.trim();
    if (name.length < 2) throw new ActionError("Nama bahan minimal 2 huruf.");
    const min = Number(input.minStock);
    if (!(min >= 0 && min <= 100000)) throw new ActionError("Stok minimum tidak valid.");
    if (input.id) {
      await db.update(t.materials).set({ name, minStock: min, tracked: input.tracked }).where(eq(t.materials.id, input.id));
      await logActivity(db, user.id, "ubah_bahan", String(input.id), name);
    } else {
      const code = (input.code ?? "").trim().toUpperCase();
      if (!/^[A-Z]{2,5}$/.test(code)) throw new ActionError("Kode bahan 2–5 huruf, mis. MTG.");
      if (await db.query.materials.findFirst({ where: eq(t.materials.code, code) })) throw new ActionError(`Kode ${code} sudah dipakai.`);
      await db.insert(t.materials).values({ code, name, minStock: min, tracked: input.tracked, stock: 0, image: null });
      await logActivity(db, user.id, "buat_bahan", code, name);
    }
    revalidatePath("/", "layout");
    return { name };
  });
}

export async function resetDemo() {
  return safe(async () => {
    const user = await actionUser();
    if (user.role !== "admin") throw new ActionError("Hanya Admin yang bisa mereset data demo.");
    await seedDatabase(db as unknown as Parameters<typeof seedDatabase>[0]);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
