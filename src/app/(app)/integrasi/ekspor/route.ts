import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/access";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Unduh semua dokumen posting (cadangan jika ERP belum terhubung). */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !can(user.role, "integrasi")) return new Response("Tidak diizinkan", { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";
  const rows = await db.query.postings.findMany({ orderBy: asc(t.postings.id) });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new Response(JSON.stringify(rows.map((r) => ({ code: r.code, type: r.type, status: r.status, created_at: r.createdAt, payload: JSON.parse(r.payload) })), null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="posting-erp-${stamp}.json"` },
    });
  }
  const head = ["kode", "jenis", "referensi", "status", "dibuat", "terkirim", "payload_json"];
  const lines = [head.join(";"), ...rows.map((r) => [r.code, r.type, r.ref, r.status, r.createdAt, r.deliveredAt, r.payload].map(cell).join(";"))];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="posting-erp-${stamp}.csv"` },
  });
}
