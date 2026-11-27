// Data awal (contoh) untuk uji coba Fase 1. Bisa dijalankan ulang dari menu Admin → Reset data demo.
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import * as s from "./schema";
import { hashPin } from "../lib/pin";
import { splitBatches, stdQty, isOutOfTolerance, goodQty } from "../lib/rules";
import { todayISO, yymmdd } from "../lib/format";

type DB = LibSQLDatabase<typeof s>;

const USERS = [
  { name: "Admin", title: "Administrator", role: "admin", pin: "0000", color: "#57534E" },
  { name: "Rina", title: "PPIC", role: "ppic", pin: "1111", color: "#7C3AED" },
  { name: "Budi", title: "Operator", role: "operator", pin: "2222", color: "#0369A1" },
  { name: "Sari", title: "Operator", role: "operator", pin: "3333", color: "#0F766E" },
  { name: "Dewi", title: "Gudang", role: "gudang", pin: "4444", color: "#B45309" },
  { name: "Hendra", title: "Supervisor", role: "supervisor", pin: "5555", color: "#BE123C" },
] as const;

const MATERIALS = [
  { code: "TPG", name: "Tepung Terigu", image: "tepung-terigu", stock: 240, minStock: 100 },
  { code: "BTR", name: "Butter", image: "butter", stock: 58, minStock: 20 },
  { code: "GLP", name: "Gula Pasir", image: "gula-pasir", stock: 75, minStock: 25 },
  { code: "RGI", name: "Ragi Instan", image: "ragi-instan", stock: 3.6, minStock: 1.5 },
  { code: "GRM", name: "Garam", image: "garam", stock: 9, minStock: 3 },
  { code: "SSU", name: "Susu Bubuk", image: "susu-bubuk", stock: 14, minStock: 5 },
  { code: "TLR", name: "Telur", image: "telur", stock: 18, minStock: 10 },
  { code: "SLC", name: "Selai Cokelat", image: "selai-cokelat", stock: 5.5, minStock: 8 },
  { code: "GLH", name: "Gula Halus", image: "gula-halus", stock: 7, minStock: 3 },
  { code: "AIR", name: "Air", image: "air", stock: 0, minStock: 0, tracked: false },
];

// [kode bahan, qty per batch dasar (kg), toleransi %]
type Line = [string, number, number];
const PRODUCTS: { code: string; name: string; image: string; traySize: number; baseQty: number; note: string; lines: Line[] }[] = [
  {
    code: "CRO", name: "Croissant Original", image: "croissant", traySize: 20, baseQty: 500,
    note: "Angka tepung, butter, gula, ragi dari contoh dokumen klien; bahan lain asumsi.",
    lines: [["TPG", 25, 5], ["BTR", 10, 5], ["GLP", 5, 5], ["RGI", 0.5, 3], ["GRM", 0.5, 3], ["SSU", 1, 5], ["TLR", 2.5, 5], ["AIR", 12, 5]],
  },
  {
    code: "RSC", name: "Roti Sobek Cokelat", image: "roti-sobek-cokelat", traySize: 16, baseQty: 400,
    note: "Resep contoh, menunggu resep asli.",
    lines: [["TPG", 12, 5], ["GLP", 2.4, 5], ["BTR", 1.2, 5], ["RGI", 0.24, 3], ["GRM", 0.12, 3], ["SSU", 0.6, 5], ["TLR", 1.2, 5], ["AIR", 6, 5], ["SLC", 4, 5]],
  },
  {
    code: "DNG", name: "Donat Gula", image: "donat-gula", traySize: 24, baseQty: 600,
    note: "Resep contoh, menunggu resep asli.",
    lines: [["TPG", 15, 5], ["GLP", 1.8, 5], ["BTR", 1.5, 5], ["RGI", 0.3, 3], ["GRM", 0.15, 3], ["SSU", 0.75, 5], ["TLR", 1.5, 5], ["AIR", 6.5, 5], ["GLH", 1.8, 5]],
  },
  {
    code: "RTW", name: "Roti Tawar", image: "roti-tawar", traySize: 10, baseQty: 100,
    note: "Resep contoh, menunggu resep asli.",
    lines: [["TPG", 35, 5], ["GLP", 2.1, 5], ["BTR", 1.75, 5], ["RGI", 0.5, 3], ["GRM", 0.6, 3], ["SSU", 1.4, 5], ["AIR", 22, 5]],
  },
];

const ts = (dayOffset: number, hh: number, mm: number) =>
  new Date(`${todayISO(dayOffset)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`).toISOString();

export async function clearDatabase(db: DB) {
  // urutan: anak dulu
  for (const t of [s.agentRuns, s.dailyReports, s.postings, s.outbox, s.notificationReads, s.notifications, s.activity, s.stockMoves, s.exceptions, s.handovers, s.outputRejects, s.outputs, s.materialRequestLines, s.materialRequests, s.batchMaterials, s.batches, s.productionOrders, s.bomLines, s.bomVersions, s.products, s.materials, s.users]) {
    await db.delete(t);
  }
}

export async function seedDatabase(db: DB) {
  await clearDatabase(db);

  const users = await db.insert(s.users).values(USERS.map((u) => ({ name: u.name, title: u.title, role: u.role, color: u.color, pinHash: hashPin(u.pin) }))).returning();
  const uid = (name: string) => users.find((u) => u.name === name)!.id;

  const mats = await db.insert(s.materials).values(MATERIALS.map((m) => ({ code: m.code, name: m.name, image: `/img/${m.image}.webp`, stock: m.stock, minStock: m.minStock, tracked: m.tracked ?? true }))).returning();
  const mid = (code: string) => mats.find((m) => m.code === code)!.id;

  const prods: Record<string, { id: number; bomId: number; baseQty: number; traySize: number; lines: Line[] }> = {};
  for (const p of PRODUCTS) {
    const [prod] = await db.insert(s.products).values({ code: p.code, name: p.name, image: `/img/${p.image}.webp`, traySize: p.traySize }).returning();
    const [bom] = await db.insert(s.bomVersions).values({ productId: prod.id, version: 1, baseQty: p.baseQty, note: p.note, createdAt: ts(-7, 8, 0), createdBy: uid("Rina") }).returning();
    await db.insert(s.bomLines).values(p.lines.map(([code, qty, tol], i) => ({ bomVersionId: bom.id, materialId: mid(code), qty, tolerancePct: tol, sort: i })));
    prods[p.code] = { id: prod.id, bomId: bom.id, baseQty: p.baseQty, traySize: p.traySize, lines: p.lines };
  }

  let orderSeq = 0;
  let reqSeq = 0;
  let exSeq = 0;

  /** Buat order + batch + permintaan bahan seperti yang dilakukan aplikasi. */
  async function makeOrder(code: string, qty: number, day: number, reqStatus: "baru" | "disiapkan" | "diserahkan") {
    const p = prods[code];
    const date = todayISO(day);
    orderSeq++;
    const [order] = await db.insert(s.productionOrders).values({ code: `PRD-${yymmdd(date)}-${String(orderSeq).padStart(2, "0")}`, date, productId: p.id, qty, bomVersionId: p.bomId, createdBy: uid("Rina"), createdAt: ts(day, 6, 30) }).returning();
    const sizes = splitBatches(qty, p.baseQty);
    const batchRows = [];
    for (let i = 0; i < sizes.length; i++) {
      const [b] = await db.insert(s.batches).values({ code: `${code}-${yymmdd(date)}-${String(i + 1).padStart(2, "0")}`, orderId: order.id, productId: p.id, date, target: sizes[i], status: "menunggu", createdAt: ts(day, 6, 30) }).returning();
      await db.insert(s.batchMaterials).values(p.lines.map(([mc, q, tol], k) => ({ batchId: b.id, materialId: mid(mc), stdQty: stdQty(q, sizes[i], p.baseQty), tolerancePct: tol, sort: k })));
      batchRows.push(b);
    }
    reqSeq++;
    const [rq] = await db.insert(s.materialRequests).values({ code: `RQ-${yymmdd(date)}-${String(reqSeq).padStart(2, "0")}`, orderId: order.id, status: reqStatus, createdAt: ts(day, 6, 31), updatedAt: ts(day, 7, 0), handledBy: reqStatus === "baru" ? null : uid("Dewi") }).returning();
    await db.insert(s.materialRequestLines).values(p.lines.filter(([mc]) => mc !== "AIR").map(([mc, q]) => ({ requestId: rq.id, materialId: mid(mc), qty: stdQty(q, qty, p.baseQty), shortage: 0 })));
    return batchRows;
  }

  /** Isi hasil timbang. factors: pengali berat aktual per kode bahan (default mendekati pas). */
  async function weigh(batchId: number, day: number, by: string, factors: Record<string, number> = {}, onlyCodes?: string[], reason?: string) {
    const rows = await db.query.batchMaterials.findMany({ where: (bm, { eq }) => eq(bm.batchId, batchId) });
    let minute = 0;
    for (const r of rows) {
      const mat = mats.find((m) => m.id === r.materialId)!;
      if (onlyCodes && !onlyCodes.includes(mat.code)) continue;
      const f = factors[mat.code] ?? 1 + (((r.id * 37) % 9) - 4) / 1000; // variasi kecil ±0,4%
      const step = r.stdQty < 3 ? 1000 : 100;
      const actual = Math.round(r.stdQty * f * step) / step;
      const out = isOutOfTolerance(actual, r.stdQty, r.tolerancePct);
      minute += 3;
      const at = ts(day, 7, minute);
      await db.update(s.batchMaterials).set({ actualQty: actual, source: "timbangan", weighedBy: uid(by), weighedAt: at, outOfTolerance: out, reason: out ? reason ?? null : null }).where(eqId(s.batchMaterials.id, r.id));
      if (out) {
        exSeq++;
        await db.insert(s.exceptions).values({ code: `EX-${yymmdd(todayISO(day))}-${String(exSeq).padStart(2, "0")}`, type: "bahan", batchId, materialId: r.materialId, expected: r.stdQty, actual, reason: reason ?? null, status: "terbuka", createdAt: at, createdBy: uid(by) });
      }
    }
  }

  async function output(batchId: number, day: number, trays: number, loose: number, rejects: Record<string, number>) {
    await db.insert(s.outputs).values({ batchId, trays, loose, recordedBy: uid("Sari"), recordedAt: ts(day, 11, 15) });
    const rows = Object.entries(rejects).filter(([, q]) => q > 0).map(([reason, qty]) => ({ batchId, reason, qty }));
    if (rows.length) await db.insert(s.outputRejects).values(rows);
  }

  async function handover(batchId: number, code: string, day: number, sent: number, recv: number) {
    await db.insert(s.handovers).values({ batchId, code: `ST-${code}`, qtySent: sent, qtyReceived: recv, receivedBy: uid("Dewi"), receivedAt: ts(day, 13, 0) });
  }

  const setStatus = (id: number, status: s.BatchStatus, extra: Partial<typeof s.batches.$inferInsert> = {}) =>
    db.update(s.batches).set({ status, ...extra }).where(eqId(s.batches.id, id));

  // ---- Kemarin: 2 order selesai & ditutup ----
  const [dng] = await makeOrder("DNG", 600, -1, "diserahkan");
  await weigh(dng.id, -1, "Budi");
  await output(dng.id, -1, 24, 12, { gosong: 5, bentuk: 4, kembang: 3 });
  await handover(dng.id, dng.code, -1, goodQty(24, 24, 12), goodQty(24, 24, 12));
  await setStatus(dng.id, "ditutup", { closedAt: ts(-1, 15, 0), closedBy: uid("Hendra") });

  const [rtw] = await makeOrder("RTW", 100, -1, "diserahkan");
  await weigh(rtw.id, -1, "Sari");
  await output(rtw.id, -1, 9, 7, { kembang: 2, bentuk: 1 });
  await handover(rtw.id, rtw.code, -1, 97, 97);
  await setStatus(rtw.id, "ditutup", { closedAt: ts(-1, 15, 30), closedBy: uid("Hendra") });

  // ---- Hari ini ----
  const [cro1, cro2] = await makeOrder("CRO", 1000, 0, "diserahkan");
  // Batch 2 lebih dulu: selesai ditimbang, butter kelebihan +12% (contoh notifikasi dokumen klien), output tercatat
  await weigh(cro2.id, 0, "Budi", { BTR: 1.12 }, undefined, "Adonan terlalu kering, butter ditambah");
  await output(cro2.id, 0, 23, 15, { gosong: 4, bentuk: 3 });
  await setStatus(cro2.id, "output");
  // Batch 1: sedang ditimbang (2 dari 8 bahan)
  await weigh(cro1.id, 0, "Budi", { TPG: 1, BTR: 1.004 }, ["TPG", "BTR"]);
  await setStatus(cro1.id, "ditimbang");

  const [rsc] = await makeOrder("RSC", 400, 0, "diserahkan");
  await weigh(rsc.id, 0, "Sari");
  await setStatus(rsc.id, "produksi");

  // Order baru, bahan belum disiapkan gudang
  await makeOrder("RTW", 200, 0, "baru");

  await db.insert(s.activity).values({ ts: new Date().toISOString(), userId: uid("Admin"), action: "seed", detail: "Data demo dibuat" });
}

function eqId(col: SQLiteColumn, id: number) {
  return eq(col, id);
}
