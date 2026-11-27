import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { REJECT_REASONS } from "@/db/schema";
import { notify } from "./notify";
import { createPosting, deliverPostings } from "./posting";
import { dispatchOutbox } from "./channels";
import { goodQty, variance } from "./rules";
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
      await notify({ event: "selesai_timbang", roles: ["operator"], severity: "info", title: `${b.code} masuk produksi`, body: `Semua bahan ${b.product.name} sudah ditimbang. Catat hasilnya setelah keluar oven.`, link: `/output/${b.code}` });
      await createPosting("PEMAKAIAN_BAHAN", b.code, {
        batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, target_pcs: b.target,
        lines: b.materials.map((m) => ({ material_code: m.material.code, material_name: m.material.name, std_kg: m.stdQty, actual_kg: m.actualQty, source: m.source, out_of_tolerance: m.outOfTolerance })),
      });
    }),

  outputRecorded: (d: { batchCode: string; product: string; good: number; reject: number }) =>
    guard("outputRecorded", () => notify({ event: "output_dicatat", roles: ["gudang"], severity: "info", title: `${d.product} siap diserahkan`, body: `Batch ${d.batchCode}: ${num(d.good)} pcs bagus siap dihitung dan diterima gudang FG.`, link: `/serah-terima/${d.batchCode}` })),

  handover: (batchCode: string) =>
    guard("handover", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true, handover: true, exceptions: true } });
      if (!b?.handover) return;
      const h = b.handover;
      if (h.qtyReceived !== h.qtySent)
        await notify({ event: "selisih_serah_terima", roles: ["supervisor"], severity: "bad", title: `Selisih serah terima · ${b.code}`, body: `${b.product.name}: diserahkan ${num(h.qtySent)}, diterima ${num(h.qtyReceived)} pcs. Alasan: ${h.note ?? "-"}.`, link: "/verifikasi" });
      const open = b.exceptions.filter((e) => e.status !== "disetujui").length;
      await notify({ event: "siap_tutup", roles: ["supervisor"], severity: open ? "warn" : "good", title: `${b.code} diterima gudang`, body: open ? `Masih ada ${open} penyimpangan yang perlu disetujui sebelum batch ditutup.` : "Semua langkah lengkap. Batch siap ditutup.", link: "/verifikasi" });
      await createPosting("PENERIMAAN_FG", b.code, { batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, qty_sent_pcs: h.qtySent, qty_received_pcs: h.qtyReceived, handover_code: h.code });
    }),

  batchClosed: (batchCode: string) =>
    guard("batchClosed", async () => {
      const b = await db.query.batches.findFirst({ where: eq(t.batches.code, batchCode), with: { product: true, output: true, rejects: true, handover: true, exceptions: true, materials: { with: { material: true } } } });
      if (!b?.output) return;
      const good = goodQty(b.output.trays, b.product.traySize, b.output.loose);
      await createPosting("PENYELESAIAN_PRODUKSI", b.code, {
        batch: b.code, date: b.date, product_code: b.product.code, product_name: b.product.name, closed_at: b.closedAt,
        target_pcs: b.target, good_pcs: good, received_pcs: b.handover?.qtyReceived ?? null,
        reject: REJECT_REASONS.map((r) => ({ reason: r.key, label: r.label, qty: b.rejects.filter((x) => x.reason === r.key).reduce((a, x) => a + x.qty, 0) })).filter((r) => r.qty > 0),
        material_variance: b.materials.map((m) => ({ material_code: m.material.code, std_kg: m.stdQty, actual_kg: m.actualQty, variance_kg: m.actualQty != null ? Math.round((m.actualQty - m.stdQty) * 1000) / 1000 : null })),
        exceptions: b.exceptions.map((e) => ({ code: e.code, type: e.type, status: e.status, note: e.resolutionNote })),
      });
    }),
};
