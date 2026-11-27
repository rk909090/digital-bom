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
  const head = ["tanggal", "batch", "produk", "status", "target_pcs", "bagus_pcs", "reject_pcs", "diterima_gudang_pcs", "jumlah_penyimpangan"];
  const lines = [head.join(";"), ...r.batches.map((b) => [b.date, b.code, b.product, b.status, b.target, b.good, b.reject, b.received, b.exceptions].map(cell).join(";"))];
  // BOM agar Excel membaca UTF-8 dengan benar; pemisah ; sesuai Excel lokal Indonesia
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-produksi-${r.from}-sd-${r.to}.csv"`,
    },
  });
}
