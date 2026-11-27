import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { REJECT_REASONS } from "@/db/schema";
import { notify } from "./notify";
import { createPosting, deliverPostings } from "./posting";
import { dispatchOutbox } from "./channels";
import { goodQty, laborHours, productivity, variance, yieldPct } from "./rules";
import { weight, pctSigned, num } from "./format";

// Kejadian bisnis → notifikasi (di aplikasi + Telegram/WhatsApp) dan dokumen posting ERP.
// Semua fungsi di sini aman dipanggil setelah transaksi: tidak melempar error ke pemanggil.

/** Kirim antrean segera di latar belakang (tidak menunggu jadwal agent). */
export function kick() {
  setTimeout(() => {
    dispatchOutbox().catch((e) => console.error("[kick] outbox", e));
    deliverPostings().catch((e) => console.error("[kick] posting", e));
  }, 0);
}

async function guard(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[event:${name}]`, e);
  } finally {
    kick();
  }
}

export const events = {
  planCreated: (d: { orderCode: string; reqCode: string; product: string; qty: number; batches: number; shortages: { name: string; qty: number }[] }) =>
    guard("planCreated", async () => {
      await notify({ event: "rencana_baru", roles: ["gudang"], severity: "info", title: `Permintaan bahan baru ${d.reqCode}`, body: `${d.product} ${num(d.qty)} pcs (${d.batches} batch). Siapkan bahan lalu serahkan ke produksi.`, link: "/gudang" });
      if (d.shortages.length)
        await notify({ event: "perlu_dibeli", roles: ["ppic", "gudang"], severity: "warn", title: `${d.shortages.length} bahan perlu dibeli untuk ${d.orderCode}`, body: d.shortages.map((s) => `${s.name}: kurang ${weight(s.qty)}`).join(", "), link: "/gudang" });
    }),

  requestAdvanced: (d: { code: string; status: string; product: string }) =>
    guard("requestAdvanced", async () => {
      if (d.status === "diserahkan") await notify({ event: "bahan_diserahkan", roles: ["operator"], severity: "good", title: `Bahan ${d.product} sudah diserahkan`, body: `Permintaan ${d.code} sudah diterima produksi. Batch siap ditimbang.`, link: "/timbang" });
    }),

  stockReceived: (d: { code: string; name: string; qty: number; note?: string | null; moveId: number }) =>
    guard("stockReceived", () => createPosting("PENERIMAAN_BAHAN", `SM${d.moveId}`, { material_code: d.code, material_name: d.name, qty_kg: d.qty, note: d.note ?? null })),

  weighOut: (d: { batchCode: string; product: string; material: string; std: number; actual: number; reason: string; exCode: string }) =>
    guard("weighOut", () =>
      notify({
        event: "selisih_bahan",
        roles: ["supervisor"],
        severity: "bad",
        title: `Material Variance Alert · ${d.batchCode}`,
        body: `${d.product}: ${d.material} standar ${weight(d.std)}, aktual ${weight(d.actual)} (${pctSigned(variance(d.actual, d.std))}). Alasan operator: ${d.reason}. Mohon verifikasi sebelum batch ditutup.`,
        link: "/verifikasi",
      }),
    ),

  batchWeighed: (batchId: number) =>
    guard("batchWeighed", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.id, batchId), with: { product: true, materials: { with: { material: true }, orderBy: asc(t.batchMaterials.sort) } } });
      if (!b) return;
      const dough = b.materials.reduce((acc, m) => acc + (m.actualQty ?? 0), 0);
      await notify({ event: "adonan_siap", roles: ["gudang_wip"], severity: "info", title: `Adonan ${b.code} siap masuk freezer`, body: `Semua bahan ${b.product.name} sudah ditimbang (±${weight(dough)}). Terima adonan ke freezer.`, link: "/wip" });
      await createPosting("PEMAKAIAN_BAHAN", b.code, {
        batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, target_pcs: b.target,
        lines: b.materials.map((m) => ({ material_code: m.material.code, material_name: m.material.name, std_kg: m.stdQty, actual_kg: m.actualQty, source: m.source, out_of_tolerance: m.outOfTolerance })),
      });
    }),

  wipIn: (batchCode: string) =>
    guard("wipIn", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true } });
      if (!b) return;
      await createPosting("WIP_MASUK", b.code, { batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, dough_kg: b.doughKg, at: b.wipInAt, location: "Gudang WIP (freezer)" });
    }),

  wipOut: (batchCode: string) =>
    guard("wipOut", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true } });
      if (!b) return;
      await notify({ event: "adonan_keluar", roles: ["operator"], severity: "info", title: `Adonan ${b.code} keluar freezer`, body: `${b.product.name} (${b.doughKg != null ? weight(b.doughKg) : "-"}) siap diproses. Catat hasilnya setelah keluar oven.`, link: `/output/${b.code}` });
      await createPosting("WIP_KELUAR", b.code, { batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, dough_kg: b.doughKg, at: b.wipOutAt });
    }),

  outputRecorded: (d: { batchCode: string; product: string; good: number; reject: number }) =>
    guard("outputRecorded", () => notify({ event: "output_dicatat", roles: ["packing"], severity: "info", title: `${d.product} siap dikirim`, body: `Batch ${d.batchCode}: ${num(d.good)} pcs bagus siap di-packing dan dikirim ke gudang atau outlet.`, link: `/pengiriman/${d.batchCode}` })),

  shipped: (batchCode: string) =>
    guard("shipped", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true, handover: true, exceptions: true } });
      if (!b?.handover) return;
      const h = b.handover;
      const open = b.exceptions.filter((e) => e.status !== "disetujui").length;
      await notify({ event: "siap_tutup", roles: ["supervisor"], severity: open ? "warn" : "good", title: `${b.code} dikirim ke ${h.destination}`, body: open ? `Masih ada ${open} penyimpangan yang perlu disetujui sebelum batch ditutup.` : "Semua langkah lengkap. Batch siap ditutup.", link: "/verifikasi" });
      await createPosting("PENGIRIMAN_FG", b.code, { batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, destination: h.destination, qty_pcs: h.qtySent, shipment_code: h.code, approved_by: "sistem" });
    }),

  batchClosed: (batchCode: string) =>
    guard("batchClosed", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true, output: true, rejects: true, handover: true, exceptions: true, materials: { with: { material: true } } } });
      if (!b?.output) return;
      const good = goodQty(b.output.trays, b.product.traySize, b.output.loose);
      const prod = productivity(good, b.output.workers, b.output.hours);
      await createPosting("PENYELESAIAN_PRODUKSI", b.code, {
        batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, closed_at: b.closedAt,
        standard_output_pcs: b.target, good_pcs: good, yield_pct: Math.round(yieldPct(good, b.target) * 10000) / 100,
        dough_kg: b.doughKg, shipped_pcs: b.handover?.qtySent ?? null, destination: b.handover?.destination ?? null,
        labor: { workers: b.output.workers, hours: b.output.hours, man_hours: laborHours(b.output.workers, b.output.hours), pcs_per_man_hour: prod != null ? Math.round(prod * 100) / 100 : null },
        reject: REJECT_REASONS.map((r) => ({ reason: r.key, label: r.label, qty: b.rejects.filter((x) => x.reason === r.key).reduce((acc, x) => acc + x.qty, 0) })).filter((r) => r.qty > 0),
        material_variance: b.materials.map((m) => ({ material_code: m.material.code, std_kg: m.stdQty, actual_kg: m.actualQty, variance_kg: m.actualQty != null ? Math.round((m.actualQty - m.stdQty) * 1000) / 1000 : null })),
        exceptions: b.exceptions.map((e) => ({ code: e.code, type: e.type, status: e.status, note: e.resolutionNote })),
      });
    }),
};
