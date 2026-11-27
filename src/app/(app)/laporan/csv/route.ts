import { getUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { buildReport, PERIODS, type Period } from "@/lib/report";

export const dynamic = "force-dynamic";

function cell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !can(user.role, "laporan")) return new Response("Tidak diizinkan", { status: 403 });
  const q = new URL(req.url).searchParams.get("p");
  const p: Period = q && q in PERIODS ? (q as Period) : "7";
  const r = await buildReport(p);
  const head = ["tanggal", "batch", "produk", "status", "standar_output_pcs", "bagus_pcs", "yield_pct", "reject_pcs", "reject_gagal_proving", "reject_gagal_oven", "adonan_kg", "orang", "jam", "orang_jam", "pcs_per_orang_jam", "dikirim_pcs", "tujuan", "jumlah_penyimpangan"];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const lines = [
    head.join(";"),
    ...r.batches.map((b) =>
      [
        b.date, b.code, b.product, b.status, b.target, b.good, b.good != null && b.target ? r2((b.good / b.target) * 100) : null, b.reject,
        b.good != null ? b.rejectBy.proving : null, b.good != null ? b.rejectBy.oven : null, b.doughKg != null ? r2(b.doughKg) : null,
        b.good != null ? b.workers : null, b.good != null ? b.hours : null, b.good != null ? r2(b.manHours) : null,
        b.good != null && b.manHours > 0 ? r2(b.good / b.manHours) : null, b.shipped, b.destination, b.exceptions,
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  // BOM agar Excel membaca UTF-8 dengan benar; pemisah ; sesuai Excel lokal Indonesia
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-produksi-${r.from}-sd-${r.to}.csv"`,
    },
  });
}
