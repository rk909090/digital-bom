import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db, t } from "@/db";
import { goodQty, stdQty } from "./rules";
import type { BatchStatus } from "@/db/schema";

const batchWith = {
  product: true,
  materials: { with: { material: true }, orderBy: asc(t.batchMaterials.sort) },
  output: true,
  rejects: true,
  handover: true,
  exceptions: true,
} as const;

export type BatchFull = NonNullable<Awaited<ReturnType<typeof getBatch>>>;

export async function getBatch(code: string) {
  return db.query.batches.findFirst({
    where: eq(t.batches.code, code),
    with: {
      ...batchWith,
      order: true,
      closer: true,
      materials: { with: { material: true, weigher: true }, orderBy: asc(t.batchMaterials.sort) },
      output: { with: { recorder: true } },
      handover: { with: { receiver: true } },
      exceptions: { with: { material: true, creator: true, resolver: true } },
    },
  });
}

export async function listBatches(opts: { statuses?: BatchStatus[]; from?: string; to?: string } = {}) {
  const where = and(
    opts.statuses ? inArray(t.batches.status, opts.statuses) : undefined,
    opts.from ? gte(t.batches.date, opts.from) : undefined,
    opts.to ? lte(t.batches.date, opts.to) : undefined,
  );
  const rows = await db.query.batches.findMany({ where, with: batchWith, orderBy: [asc(t.batches.date), asc(t.batches.code)] });
  return rows.map(summarize);
}

export function summarize(b: Awaited<ReturnType<typeof db.query.batches.findMany<{ with: typeof batchWith }>>>[number]) {
  const weighed = b.materials.filter((m) => m.actualQty != null).length;
  const good = b.output ? goodQty(b.output.trays, b.product.traySize, b.output.loose) : null;
  const reject = b.output ? b.rejects.reduce((a, r) => a + r.qty, 0) : null;
  const openEx = b.exceptions.filter((e) => e.status !== "disetujui").length;
  return {
    id: b.id, code: b.code, date: b.date, target: b.target, status: b.status,
    product: b.product, weighed, totalLines: b.materials.length, good, reject, openEx,
    received: b.handover?.qtyReceived ?? null,
  };
}
export type BatchSummary = ReturnType<typeof summarize>;

export async function openExceptions() {
  return db.query.exceptions.findMany({
    where: ne(t.exceptions.status, "disetujui"),
    with: { batch: { with: { product: true } }, material: true, creator: true },
    orderBy: desc(t.exceptions.createdAt),
  });
}

export async function recentResolvedExceptions(limit = 10) {
  return db.query.exceptions.findMany({
    where: eq(t.exceptions.status, "disetujui"),
    with: { batch: { with: { product: true } }, material: true, creator: true, resolver: true },
    orderBy: desc(t.exceptions.resolvedAt),
    limit,
  });
}

export async function listMaterials() {
  return db.query.materials.findMany({ orderBy: asc(t.materials.id) });
}

/** Produk aktif + versi BOM aktif + baris BOM. */
export async function productsWithBom() {
  const prods = await db.query.products.findMany({
    where: eq(t.products.active, true),
    orderBy: asc(t.products.id),
    with: {
      bomVersions: {
        where: eq(t.bomVersions.active, true),
        with: { lines: { with: { material: true }, orderBy: asc(t.bomLines.sort) }, author: true },
        orderBy: desc(t.bomVersions.version),
        limit: 1,
      },
    },
  });
  return prods.filter((p) => p.bomVersions.length && p.bomVersions[0].lines.length).map(({ bomVersions, ...p }) => ({ ...p, bom: bomVersions[0] }));
}
export type ProductWithBom = Awaited<ReturnType<typeof productsWithBom>>[number];

/** Kebutuhan bahan yang belum ditimbang dari batch yang masih berjalan (sudah "dipesan"). */
export async function reservedByMaterial(): Promise<Record<number, number>> {
  const rows = await db
    .select({ materialId: t.batchMaterials.materialId, std: t.batchMaterials.stdQty, actual: t.batchMaterials.actualQty })
    .from(t.batchMaterials)
    .innerJoin(t.batches, eq(t.batches.id, t.batchMaterials.batchId))
    .where(inArray(t.batches.status, ["menunggu", "ditimbang"]));
  return rows.reduce<Record<number, number>>((acc, r) => {
    if (r.actual == null) acc[r.materialId] = (acc[r.materialId] ?? 0) + r.std;
    return acc;
  }, {});
}

export async function listOrders(limit = 15) {
  return db.query.productionOrders.findMany({
    with: { product: true, batches: { orderBy: asc(t.batches.code) }, author: true },
    orderBy: [desc(t.productionOrders.date), desc(t.productionOrders.id)],
    limit,
  });
}

export async function listRequests(statuses?: ("baru" | "disiapkan" | "diserahkan")[]) {
  return db.query.materialRequests.findMany({
    where: statuses ? inArray(t.materialRequests.status, statuses) : undefined,
    with: {
      order: { with: { product: true, batches: true } },
      lines: { with: { material: true } },
      handler: true,
    },
    orderBy: [desc(t.materialRequests.createdAt)],
  });
}
export type RequestFull = Awaited<ReturnType<typeof listRequests>>[number];

/** Hitung kebutuhan untuk form rencana (dipakai juga oleh server action). */
export function computeRequirement(
  product: ProductWithBom,
  qty: number,
  materials: { id: number; stock: number; tracked: boolean }[],
  reserved: Record<number, number>,
) {
  return product.bom.lines.map((l) => {
    const need = stdQty(l.qty, qty, product.bom.baseQty);
    const m = materials.find((x) => x.id === l.materialId)!;
    const available = m.tracked ? Math.max(0, m.stock - (reserved[l.materialId] ?? 0)) : Infinity;
    return { materialId: l.materialId, need, available, shortage: m.tracked ? Math.max(0, need - available) : 0, tracked: m.tracked };
  });
}

export async function stockMovesFor(materialId: number, limit = 8) {
  return db.query.stockMoves.findMany({ where: eq(t.stockMoves.materialId, materialId), with: { user: true }, orderBy: desc(t.stockMoves.createdAt), limit });
}

export async function navCounts() {
  const [bs, ex, rq] = await Promise.all([
    db.select({ status: t.batches.status }).from(t.batches).where(ne(t.batches.status, "ditutup")),
    db.$count(t.exceptions, ne(t.exceptions.status, "disetujui")),
    db.$count(t.materialRequests, ne(t.materialRequests.status, "diserahkan")),
  ]);
  const c = (s: string[]) => bs.filter((b) => s.includes(b.status)).length;
  return {
    timbang: c(["menunggu", "ditimbang"]),
    output: c(["produksi"]),
    serahTerima: c(["output"]),
    tutup: c(["diterima"]),
    verifikasi: ex,
    gudang: rq,
  };
}
export type NavCounts = Awaited<ReturnType<typeof navCounts>>;
