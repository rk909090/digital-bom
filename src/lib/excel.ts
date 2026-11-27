import "server-only";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, t } from "@/db";
import { REJECT_REASONS } from "@/db/schema";
import { buildReport, PERIODS, type Period } from "./report";
import { reservedByMaterial } from "./queries";
import { goodQty } from "./rules";

const WIB = 7 * 3600_000;
/** ISO (UTC) → Date yang ditampilkan Excel sebagai jam WIB. */
const ts = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + WIB) : null);
/** "YYYY-MM-DD" → Date (tanpa jam). */
const day = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : null);
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type Col = { header: string; key: string; width?: number; fmt?: string };

/** Tambah sheet bergaya tabel: header tebal, baris pertama dibekukan, filter otomatis. */
function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(10, c.header.length + 2), style: c.fmt ? { numFmt: c.fmt } : undefined }));
  ws.addRows(rows);
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FF1F2937" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF0E6" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

const F = { date: "yyyy-mm-dd", time: "yyyy-mm-dd hh:mm", int: "#,##0", dec1: "#,##0.0", dec2: "#,##0.00", dec3: "#,##0.000", pct: "0.0%" };

/**
 * Workbook laporan produksi untuk periode (siap diimpor ke ERP / diolah di Excel).
 * Sheet: Ringkasan, Batch, Pemakaian Bahan, WIP Freezer, Hasil & Reject, Pengiriman FG, Produktivitas, Stok Bahan, Posting ERP.
 */
export async function reportWorkbook(p: Period) {
  const r = await buildReport(p);
  const [lines, outs, ships, mats, reserved, posts] = await Promise.all([
    db.query.batches.findMany({
      where: and(gte(t.batches.date, r.from), lte(t.batches.date, r.to)),
      with: { product: true, materials: { with: { material: true, weigher: true }, orderBy: asc(t.batchMaterials.sort) } },
      orderBy: [asc(t.batches.date), asc(t.batches.code)],
    }),
    db.query.batches.findMany({
      where: and(gte(t.batches.date, r.from), lte(t.batches.date, r.to)),
      with: { product: true, output: { with: { recorder: true } }, rejects: true, wipInUser: true, wipOutUser: true },
      orderBy: [asc(t.batches.date), asc(t.batches.code)],
    }),
    db.query.handovers.findMany({ with: { batch: { with: { product: true } }, receiver: true }, orderBy: asc(t.handovers.receivedAt) }),
    db.query.materials.findMany({ orderBy: asc(t.materials.code) }),
    reservedByMaterial(),
    db.query.postings.findMany({ orderBy: desc(t.postings.id), limit: 2000 }),
  ]);
  const inRange = (iso: string) => {
    const d = new Date(Date.parse(iso) + WIB).toISOString().slice(0, 10);
    return d >= r.from && d <= r.to;
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "Smart Bakery Production";
  wb.created = new Date();

  // 1. Ringkasan
  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 36 }, { width: 22 }, { width: 40 }];
  const sum: [string, unknown, string?, string?][] = [
    ["Laporan Produksi Smart Bakery", null],
    ["Periode", `${r.from} s/d ${r.to}`, PERIODS[p].label],
    ["Dibuat", ts(new Date().toISOString()), "WIB", F.time],
    ["", null],
    ["Batch direncanakan", r.planned, undefined, F.int],
    ["Batch sudah mencatat hasil", r.finished, undefined, F.int],
    ["Standar output BOM (pcs)", r.totTarget, "batch yang sudah mencatat hasil", F.int],
    ["Produk bagus (pcs)", r.totGood, undefined, F.int],
    ["Yield", r.totTarget ? r.totGood / r.totTarget : null, "bagus ÷ standar output BOM", F.pct],
    ["Reject (pcs)", r.totReject, undefined, F.int],
    ["Reject %", r.totGood + r.totReject ? r.totReject / (r.totGood + r.totReject) : null, "reject ÷ (bagus + reject)", F.pct],
    ...r.waste.map((w) => [`  Reject ${w.label.toLowerCase()} (pcs)`, w.qty, undefined, F.int] as [string, unknown, undefined, string]),
    ["Jam kerja (orang-jam)", r2(r.totManHours), "jumlah orang × lama kerja", F.dec1],
    ["Produktivitas (pcs/orang-jam)", r.totManHours > 0 ? r2(r.goodWithLabor / r.totManHours) : null, "bagus ÷ orang-jam (batch dengan jam kerja)", F.dec1],
    ["Penyimpangan belum disetujui", r.exOpen, undefined, F.int],
    ...r.byDestination.map((d) => [`Dikirim ke ${d.destination} (pcs)`, d.qty, `${d.shipments} kiriman`, F.int] as [string, unknown, string, string]),
  ];
  for (const [a, b, c, fmt] of sum) {
    const row = ws.addRow([a, b, c]);
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getColumn(1).font = { bold: true };
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };

  // 2. Batch
  addSheet(
    wb,
    "Batch",
    [
      { header: "Tanggal", key: "date", fmt: F.date, width: 12 },
      { header: "Batch", key: "code", width: 16 },
      { header: "Kode produk", key: "pcode", width: 11 },
      { header: "Produk", key: "product", width: 22 },
      { header: "Status", key: "status", width: 11 },
      { header: "Standar output (pcs)", key: "target", fmt: F.int },
      { header: "Bagus (pcs)", key: "good", fmt: F.int },
      { header: "Yield", key: "yield", fmt: F.pct },
      { header: "Reject (pcs)", key: "reject", fmt: F.int },
      { header: "Reject %", key: "rejectPct", fmt: F.pct },
      { header: "Adonan (kg)", key: "dough", fmt: F.dec2 },
      { header: "Orang", key: "workers", fmt: F.int },
      { header: "Jam", key: "hours", fmt: F.dec1 },
      { header: "Orang-jam", key: "mh", fmt: F.dec1 },
      { header: "Pcs/orang-jam", key: "prod", fmt: F.dec1 },
      { header: "Dikirim (pcs)", key: "shipped", fmt: F.int },
      { header: "Tujuan", key: "dest", width: 14 },
      { header: "Penyimpangan", key: "ex", fmt: F.int },
    ],
    r.batches.map((b) => {
      const done = b.good != null;
      return {
        date: day(b.date), code: b.code, pcode: b.productCode, product: b.product, status: b.status, target: b.target,
        good: b.good, yield: done && b.target ? b.good! / b.target : null, reject: b.reject,
        rejectPct: done && b.good! + b.reject! ? b.reject! / (b.good! + b.reject!) : null,
        dough: b.doughKg != null ? r2(b.doughKg) : null, workers: done ? b.workers : null, hours: done ? b.hours : null,
        mh: done ? r2(b.manHours) : null, prod: done && b.manHours > 0 ? r2(b.good! / b.manHours) : null,
        shipped: b.shipped, dest: b.destination, ex: b.exceptions,
      };
    }),
  );

  // 3. Pemakaian bahan (per baris timbang)
  addSheet(
    wb,
    "Pemakaian Bahan",
    [
      { header: "Tanggal", key: "date", fmt: F.date, width: 12 },
      { header: "Batch", key: "batch", width: 16 },
      { header: "Produk", key: "product", width: 20 },
      { header: "Kode bahan", key: "mcode", width: 11 },
      { header: "Bahan", key: "mname", width: 20 },
      { header: "Standar (kg)", key: "std", fmt: F.dec3 },
      { header: "Aktual (kg)", key: "act", fmt: F.dec3 },
      { header: "Selisih (kg)", key: "diff", fmt: F.dec3 },
      { header: "Selisih %", key: "diffPct", fmt: F.pct },
      { header: "Toleransi %", key: "tol", fmt: F.dec1 },
      { header: "Di luar toleransi", key: "out", width: 10 },
      { header: "Sumber", key: "src", width: 10 },
      { header: "Ditimbang oleh", key: "by", width: 14 },
      { header: "Waktu", key: "at", fmt: F.time, width: 17 },
    ],
    lines.flatMap((b) =>
      b.materials.map((m) => ({
        date: day(b.date), batch: b.code, product: b.product.name, mcode: m.material.code, mname: m.material.name, std: r3(m.stdQty),
        act: m.actualQty != null ? r3(m.actualQty) : null, diff: m.actualQty != null ? r3(m.actualQty - m.stdQty) : null,
        diffPct: m.actualQty != null && m.stdQty ? (m.actualQty - m.stdQty) / m.stdQty : null, tol: m.tolerancePct,
        out: m.actualQty == null ? "" : m.outOfTolerance ? "Ya" : "Tidak", src: m.actualQty != null ? m.source : "", by: m.weigher?.name ?? "", at: ts(m.weighedAt),
      })),
    ),
  );

  // 4. WIP freezer
  addSheet(
    wb,
    "WIP Freezer",
    [
      { header: "Batch", key: "batch", width: 16 },
      { header: "Produk", key: "product", width: 20 },
      { header: "Adonan (kg)", key: "kg", fmt: F.dec2 },
      { header: "Masuk freezer", key: "in", fmt: F.time, width: 17 },
      { header: "Dicatat oleh", key: "inBy", width: 14 },
      { header: "Keluar freezer", key: "out", fmt: F.time, width: 17 },
      { header: "Dicatat oleh ", key: "outBy", width: 14 },
      { header: "Lama di freezer (jam)", key: "dur", fmt: F.dec1 },
      { header: "Posisi", key: "pos", width: 14 },
    ],
    outs
      .filter((b) => b.wipInAt)
      .map((b) => ({
        batch: b.code, product: b.product.name, kg: b.doughKg, in: ts(b.wipInAt), inBy: b.wipInUser?.name ?? "", out: ts(b.wipOutAt), outBy: b.wipOutUser?.name ?? "",
        dur: b.wipOutAt ? r2((Date.parse(b.wipOutAt) - Date.parse(b.wipInAt!)) / 3600_000) : null, pos: b.wipOutAt ? "Sudah keluar" : "Di freezer",
      })),
  );

  // 5. Hasil & reject
  addSheet(
    wb,
    "Hasil & Reject",
    [
      { header: "Tanggal", key: "date", fmt: F.date, width: 12 },
      { header: "Batch", key: "batch", width: 16 },
      { header: "Produk", key: "product", width: 20 },
      { header: "Tray penuh", key: "trays", fmt: F.int },
      { header: "Isi per tray", key: "tray", fmt: F.int },
      { header: "Sisa satuan", key: "loose", fmt: F.int },
      { header: "Bagus (pcs)", key: "good", fmt: F.int },
      ...REJECT_REASONS.map((x) => ({ header: `Reject ${x.label.toLowerCase()}`, key: `rej_${x.key}`, fmt: F.int })),
      { header: "Total reject", key: "reject", fmt: F.int },
      { header: "Reject %", key: "rejectPct", fmt: F.pct },
      { header: "Sumber hitung", key: "src", width: 11 },
      { header: "Dicatat oleh", key: "by", width: 14 },
      { header: "Waktu", key: "at", fmt: F.time, width: 17 },
    ],
    outs
      .filter((b) => b.output)
      .map((b) => {
        const good = goodQty(b.output!.trays, b.product.traySize, b.output!.loose);
        const rej = b.rejects.reduce((a, x) => a + x.qty, 0);
        return {
          date: day(b.date), batch: b.code, product: b.product.name, trays: b.output!.trays, tray: b.product.traySize, loose: b.output!.loose, good,
          ...Object.fromEntries(REJECT_REASONS.map((x) => [`rej_${x.key}`, b.rejects.filter((y) => y.reason === x.key).reduce((a, y) => a + y.qty, 0)])),
          reject: rej, rejectPct: good + rej ? rej / (good + rej) : null, src: b.output!.source, by: b.output!.recorder?.name ?? "", at: ts(b.output!.recordedAt),
        };
      }),
  );

  // 6. Pengiriman FG
  addSheet(
    wb,
    "Pengiriman FG",
    [
      { header: "No. kirim", key: "code", width: 18 },
      { header: "Waktu", key: "at", fmt: F.time, width: 17 },
      { header: "Batch", key: "batch", width: 16 },
      { header: "Kode produk", key: "pcode", width: 11 },
      { header: "Produk", key: "product", width: 20 },
      { header: "Tujuan", key: "dest", width: 14 },
      { header: "Jumlah (pcs)", key: "qty", fmt: F.int },
      { header: "Dikirim oleh", key: "by", width: 14 },
      { header: "Persetujuan", key: "note", width: 18 },
    ],
    ships
      .filter((h) => inRange(h.receivedAt))
      .map((h) => ({ code: h.code, at: ts(h.receivedAt), batch: h.batch.code, pcode: h.batch.product.code, product: h.batch.product.name, dest: h.destination, qty: h.qtySent, by: h.receiver?.name ?? "", note: h.note ?? "" })),
  );

  // 7. Produktivitas per produk
  addSheet(
    wb,
    "Produktivitas",
    [
      { header: "Produk", key: "product", width: 22 },
      { header: "Batch", key: "batches", fmt: F.int },
      { header: "Standar output (pcs)", key: "target", fmt: F.int },
      { header: "Bagus (pcs)", key: "good", fmt: F.int },
      { header: "Yield", key: "yield", fmt: F.pct },
      { header: "Reject (pcs)", key: "reject", fmt: F.int },
      { header: "Orang-jam", key: "mh", fmt: F.dec1 },
      { header: "Pcs/orang-jam", key: "prod", fmt: F.dec1 },
    ],
    r.byProduct.map((x) => ({
      product: x.name, batches: x.batches, target: x.target, good: x.good, yield: x.target ? x.good / x.target : null, reject: x.reject,
      mh: r2(x.manHours), prod: x.manHours > 0 ? r2(x.goodWithLabor / x.manHours) : null,
    })),
  );

  // 8. Stok bahan (saat ini)
  addSheet(
    wb,
    "Stok Bahan",
    [
      { header: "Kode bahan", key: "code", width: 11 },
      { header: "Bahan", key: "name", width: 22 },
      { header: "Stok (kg)", key: "stock", fmt: F.dec2 },
      { header: "Stok minimum (kg)", key: "min", fmt: F.dec2 },
      { header: "Dipesan batch berjalan (kg)", key: "res", fmt: F.dec2 },
      { header: "Tersedia (kg)", key: "avail", fmt: F.dec2 },
      { header: "Dipantau", key: "tracked", width: 10 },
    ],
    mats.map((m) => ({
      code: m.code, name: m.name, stock: r2(m.stock), min: r2(m.minStock), res: r2(reserved[m.id] ?? 0),
      avail: r2(m.stock - (reserved[m.id] ?? 0)), tracked: m.tracked ? "Ya" : "Tidak",
    })),
  );

  // 9. Posting ERP (dokumen yang sama dengan webhook/API)
  addSheet(
    wb,
    "Posting ERP",
    [
      { header: "Kode", key: "code", width: 18 },
      { header: "Jenis", key: "type", width: 24 },
      { header: "Referensi", key: "ref", width: 16 },
      { header: "Status", key: "status", width: 11 },
      { header: "Dibuat", key: "created", fmt: F.time, width: 17 },
      { header: "Terkirim", key: "delivered", fmt: F.time, width: 17 },
      { header: "Isi (JSON)", key: "payload", width: 80 },
    ],
    posts
      .filter((x) => inRange(x.createdAt))
      .map((x) => ({ code: x.code, type: x.type, ref: x.ref, status: x.status, created: ts(x.createdAt), delivered: ts(x.deliveredAt), payload: x.payload.slice(0, 32000) })),
  );

  const buf = await wb.xlsx.writeBuffer();
  return { buffer: buf, filename: `laporan-produksi-${r.from}-sd-${r.to}.xlsx` };
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ---------------------------------------------------------------------------
// Impor resep (master resep per SKU) dari Excel
// ---------------------------------------------------------------------------

export const RECIPE_COLUMNS = ["kode_produk", "nama_produk", "isi_per_tray", "jumlah_dasar_pcs", "kode_bahan", "nama_bahan", "qty_kg", "toleransi_pct"] as const;

/** Template impor resep, sudah terisi resep aktif saat ini (sekaligus berfungsi sebagai ekspor master resep). */
export async function recipeTemplateWorkbook() {
  const [prods, mats] = await Promise.all([
    db.query.products.findMany({
      where: eq(t.products.active, true),
      orderBy: asc(t.products.code),
      with: { bomVersions: { where: eq(t.bomVersions.active, true), with: { lines: { with: { material: true }, orderBy: asc(t.bomLines.sort) } }, limit: 1 } },
    }),
    db.query.materials.findMany({ orderBy: asc(t.materials.code) }),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Smart Bakery Production";

  const help = wb.addWorksheet("Petunjuk");
  help.columns = [{ width: 110 }];
  [
    "CARA MENGISI TEMPLATE RESEP (BOM) PER SKU",
    "",
    "1. Isi sheet 'Resep'. Satu baris = satu bahan dalam resep satu produk.",
    "2. Kolom kode_produk, nama_produk, isi_per_tray, jumlah_dasar_pcs harus sama untuk semua baris produk yang sama.",
    "3. jumlah_dasar_pcs = jumlah pcs yang dihasilkan oleh takaran bahan pada baris-baris tersebut (dasar perhitungan BOM).",
    "4. qty_kg = berat bahan (kg) untuk jumlah_dasar_pcs. Gunakan titik atau koma untuk desimal.",
    "5. toleransi_pct boleh dikosongkan, otomatis 2 (%).",
    "6. Kode produk & kode bahan: 2–5 huruf (A–Z). Bahan dengan kode baru akan dibuat otomatis (stok awal 0).",
    "7. Produk dengan kode baru akan dibuat. Produk yang resepnya berubah akan mendapat versi resep baru; versi lama tetap tersimpan sebagai riwayat.",
    "8. Produk yang tidak ada di file ini tidak diubah.",
    "9. Unggah file di menu Resep & Bahan → Impor Excel. Sistem menampilkan pratinjau dan kesalahan sebelum data disimpan.",
  ].forEach((line, i) => {
    const row = help.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 13 };
  });

  addSheet(
    wb,
    "Resep",
    [
      { header: "kode_produk", key: "kode_produk", width: 13 },
      { header: "nama_produk", key: "nama_produk", width: 22 },
      { header: "isi_per_tray", key: "isi_per_tray", width: 12 },
      { header: "jumlah_dasar_pcs", key: "jumlah_dasar_pcs", width: 17 },
      { header: "kode_bahan", key: "kode_bahan", width: 12 },
      { header: "nama_bahan", key: "nama_bahan", width: 22 },
      { header: "qty_kg", key: "qty_kg", width: 10, fmt: "0.0000" },
      { header: "toleransi_pct", key: "toleransi_pct", width: 13 },
    ],
    prods.flatMap((p) =>
      (p.bomVersions[0]?.lines ?? []).map((l) => ({
        kode_produk: p.code, nama_produk: p.name, isi_per_tray: p.traySize, jumlah_dasar_pcs: p.bomVersions[0].baseQty,
        kode_bahan: l.material.code, nama_bahan: l.material.name, qty_kg: l.qty, toleransi_pct: l.tolerancePct,
      })),
    ),
  );

  addSheet(
    wb,
    "Daftar Bahan",
    [
      { header: "kode_bahan", key: "code", width: 12 },
      { header: "nama_bahan", key: "name", width: 26 },
    ],
    mats.map((m) => ({ code: m.code, name: m.name })),
  );

  return wb.xlsx.writeBuffer();
}

export type RecipeRow = { row: number; productCode: string; productName: string; traySize: number; baseQty: number; materialCode: string; materialName: string; qty: number; tolerancePct: number };

/** Nilai sel → teks/angka (mendukung sel rumus & rich text). */
function cellValue(v: ExcelJS.CellValue): string | number | null {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((x) => x.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v);
}
const toNum = (v: string | number | null) => (v == null || v === "" ? NaN : typeof v === "number" ? v : Number(String(v).trim().replace(/\s/g, "").replace(",", ".")));

/** Baca & validasi file resep. Mengembalikan baris yang valid dan daftar kesalahan (dengan nomor baris Excel). */
export async function parseRecipeFile(data: ArrayBuffer): Promise<{ rows: RecipeRow[]; errors: string[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return { rows: [], errors: ["File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel), bukan .xls atau .csv."] };
  }
  const ws = wb.getWorksheet("Resep") ?? wb.worksheets.find((w) => w.name !== "Petunjuk");
  if (!ws) return { rows: [], errors: ["Sheet 'Resep' tidak ditemukan."] };
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => String(cellValue(v) ?? "").trim().toLowerCase());
  const idx = Object.fromEntries(RECIPE_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof RECIPE_COLUMNS)[number], number>;
  const missing = RECIPE_COLUMNS.filter((c) => c !== "toleransi_pct" && idx[c] < 1);
  if (missing.length) return { rows: [], errors: [`Kolom wajib tidak ada di baris 1: ${missing.join(", ")}. Gunakan template dari tombol "Unduh template".`] };

  const rows: RecipeRow[] = [];
  const errors: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const get = (c: (typeof RECIPE_COLUMNS)[number]) => (idx[c] > 0 ? cellValue(row.getCell(idx[c]).value) : null);
    const raw = RECIPE_COLUMNS.map((c) => get(c));
    if (raw.every((x) => x == null || String(x).trim() === "")) return;
    const e: string[] = [];
    const productCode = String(get("kode_produk") ?? "").trim().toUpperCase();
    const productName = String(get("nama_produk") ?? "").trim();
    const materialCode = String(get("kode_bahan") ?? "").trim().toUpperCase();
    const materialName = String(get("nama_bahan") ?? "").trim();
    const traySize = toNum(get("isi_per_tray"));
    const baseQty = toNum(get("jumlah_dasar_pcs"));
    const qty = toNum(get("qty_kg"));
    const tolRaw = get("toleransi_pct");
    const tolerancePct = tolRaw == null || String(tolRaw).trim() === "" ? 2 : toNum(tolRaw);
    if (!/^[A-Z]{2,5}$/.test(productCode)) e.push("kode_produk harus 2–5 huruf");
    if (productName.length < 3) e.push("nama_produk minimal 3 huruf");
    if (!(Number.isInteger(traySize) && traySize >= 1 && traySize <= 1000)) e.push("isi_per_tray harus bilangan bulat 1–1.000");
    if (!(Number.isInteger(baseQty) && baseQty >= 1 && baseQty <= 100000)) e.push("jumlah_dasar_pcs harus bilangan bulat 1–100.000");
    if (!/^[A-Z]{2,5}$/.test(materialCode)) e.push("kode_bahan harus 2–5 huruf");
    if (materialName.length < 2) e.push("nama_bahan minimal 2 huruf");
    if (!(qty > 0 && qty < 100000)) e.push("qty_kg harus lebih dari 0");
    if (!(tolerancePct >= 0 && tolerancePct <= 50)) e.push("toleransi_pct harus 0–50");
    if (e.length) errors.push(`Baris ${n}: ${e.join("; ")}.`);
    else rows.push({ row: n, productCode, productName, traySize, baseQty, materialCode, materialName, qty: Math.round(qty * 10000) / 10000, tolerancePct });
  });

  // konsistensi per produk & duplikat bahan
  const byProduct = new Map<string, RecipeRow[]>();
  for (const r of rows) byProduct.set(r.productCode, [...(byProduct.get(r.productCode) ?? []), r]);
  for (const [code, list] of byProduct) {
    const f = list[0];
    const bad = list.find((x) => x.productName !== f.productName || x.traySize !== f.traySize || x.baseQty !== f.baseQty);
    if (bad) errors.push(`Produk ${code}: nama_produk, isi_per_tray, dan jumlah_dasar_pcs harus sama di semua barisnya (lihat baris ${f.row} dan ${bad.row}).`);
    const seen = new Map<string, number>();
    for (const x of list) {
      if (seen.has(x.materialCode)) errors.push(`Produk ${code}: bahan ${x.materialCode} tertulis dua kali (baris ${seen.get(x.materialCode)} dan ${x.row}).`);
      seen.set(x.materialCode, x.row);
    }
  }
  const matNames = new Map<string, { name: string; row: number }>();
  for (const r of rows) {
    const m = matNames.get(r.materialCode);
    if (m && m.name.toLowerCase() !== r.materialName.toLowerCase()) errors.push(`Kode bahan ${r.materialCode} dipakai dengan nama berbeda ("${m.name}" baris ${m.row}, "${r.materialName}" baris ${r.row}).`);
    else if (!m) matNames.set(r.materialCode, { name: r.materialName, row: r.row });
  }
  if (!rows.length && !errors.length) errors.push("Tidak ada baris resep yang terisi.");
  return { rows, errors: errors.slice(0, 50) };
}

export type RecipePlan = {
  products: { code: string; name: string; action: "baru" | "versi_baru" | "ubah_nama" | "sama"; version: number | null; lines: number; baseQty: number; traySize: number; changes: string[] }[];
  newMaterials: { code: string; name: string }[];
};

/** Bandingkan isi file dengan data saat ini (tanpa menyimpan). */
export async function planRecipeImport(rows: RecipeRow[]): Promise<RecipePlan> {
  const [prods, mats] = await Promise.all([
    db.query.products.findMany({
      with: { bomVersions: { where: eq(t.bomVersions.active, true), with: { lines: { with: { material: true } } }, limit: 1 } },
    }),
    db.query.materials.findMany(),
  ]);
  const matByCode = new Map(mats.map((m) => [m.code, m]));
  const newMaterials = [...new Map(rows.filter((r) => !matByCode.has(r.materialCode)).map((r) => [r.materialCode, { code: r.materialCode, name: r.materialName }])).values()];

  const groups = new Map<string, RecipeRow[]>();
  for (const r of rows) groups.set(r.productCode, [...(groups.get(r.productCode) ?? []), r]);
  const products: RecipePlan["products"] = [];
  for (const [code, list] of groups) {
    const f = list[0];
    const p = prods.find((x) => x.code === code);
    const bom = p?.bomVersions[0];
    if (!p) {
      products.push({ code, name: f.productName, action: "baru", version: 1, lines: list.length, baseQty: f.baseQty, traySize: f.traySize, changes: ["Produk baru"] });
      continue;
    }
    const changes: string[] = [];
    if (p.name !== f.productName) changes.push(`Nama: ${p.name} → ${f.productName}`);
    if (p.traySize !== f.traySize) changes.push(`Isi per tray: ${p.traySize} → ${f.traySize}`);
    if (!bom) changes.push("Belum punya resep aktif");
    else {
      if (bom.baseQty !== f.baseQty) changes.push(`Jumlah dasar: ${bom.baseQty} → ${f.baseQty} pcs`);
      const cur = new Map(bom.lines.map((l) => [l.material.code, l]));
      for (const x of list) {
        const c = cur.get(x.materialCode);
        if (!c) changes.push(`+ ${x.materialName} ${x.qty} kg`);
        else if (Math.abs(c.qty - x.qty) > 1e-9 || Math.abs(c.tolerancePct - x.tolerancePct) > 1e-9) changes.push(`${x.materialName}: ${c.qty} → ${x.qty} kg${Math.abs(c.tolerancePct - x.tolerancePct) > 1e-9 ? `, toleransi ${c.tolerancePct}% → ${x.tolerancePct}%` : ""}`);
      }
      for (const [mc, l] of cur) if (!list.some((x) => x.materialCode === mc)) changes.push(`− ${l.material.name}`);
    }
    const bomChanged = !bom || changes.some((c) => !c.startsWith("Nama:"));
    const last = (await db.query.bomVersions.findFirst({ where: eq(t.bomVersions.productId, p.id), orderBy: desc(t.bomVersions.version) }))?.version ?? 0;
    const action = bomChanged ? "versi_baru" : changes.length ? "ubah_nama" : "sama";
    products.push({ code, name: f.productName, action, version: bomChanged ? last + 1 : (bom?.version ?? null), lines: list.length, baseQty: f.baseQty, traySize: f.traySize, changes });
  }
  return { products, newMaterials };
}

/** Simpan hasil impor dalam satu transaksi. Hanya produk yang berubah yang mendapat versi resep baru. */
export async function applyRecipeImport(rows: RecipeRow[], userId: number, nowIso: string) {
  const plan = await planRecipeImport(rows);
  const result = { productsCreated: 0, versionsCreated: 0, materialsCreated: 0, renamed: 0, unchanged: 0 };
  await db.transaction(async (tx) => {
    for (const m of plan.newMaterials) {
      await tx.insert(t.materials).values({ code: m.code, name: m.name, stock: 0, minStock: 0, tracked: true, image: null });
      result.materialsCreated++;
    }
    const mats = await tx.query.materials.findMany();
    const matId = new Map(mats.map((m) => [m.code, m.id]));
    for (const p of plan.products) {
      if (p.action === "sama") {
        result.unchanged++;
        continue;
      }
      if (p.action === "ubah_nama") {
        await tx.update(t.products).set({ name: p.name }).where(eq(t.products.code, p.code));
        result.renamed++;
        continue;
      }
      const list = rows.filter((r) => r.productCode === p.code);
      let prod = await tx.query.products.findFirst({ where: eq(t.products.code, p.code) });
      if (!prod) {
        [prod] = await tx.insert(t.products).values({ code: p.code, name: p.name, traySize: p.traySize, image: null }).returning();
        result.productsCreated++;
      } else if (prod.name !== p.name || prod.traySize !== p.traySize || !prod.active) {
        await tx.update(t.products).set({ name: p.name, traySize: p.traySize, active: true }).where(eq(t.products.id, prod.id));
      }
      const last = await tx.query.bomVersions.findFirst({ where: eq(t.bomVersions.productId, prod.id), orderBy: desc(t.bomVersions.version) });
      await tx.update(t.bomVersions).set({ active: false }).where(and(eq(t.bomVersions.productId, prod.id), eq(t.bomVersions.active, true)));
      const [v] = await tx
        .insert(t.bomVersions)
        .values({ productId: prod.id, version: (last?.version ?? 0) + 1, baseQty: p.baseQty, note: "Impor Excel", active: true, createdAt: nowIso, createdBy: userId })
        .returning();
      await tx.insert(t.bomLines).values(list.map((r, i) => ({ bomVersionId: v.id, materialId: matId.get(r.materialCode)!, qty: r.qty, tolerancePct: r.tolerancePct, sort: i })));
      result.versionsCreated++;
    }
  });
  return result;
}
