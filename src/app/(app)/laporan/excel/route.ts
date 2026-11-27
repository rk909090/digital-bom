import { getUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { PERIODS, type Period } from "@/lib/report";
import { reportWorkbook, XLSX_TYPE } from "@/lib/excel";

export const dynamic = "force-dynamic";

/** Unduh laporan produksi (.xlsx, 9 sheet) — dipakai di halaman Laporan dan Integrasi ERP. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !(can(user.role, "laporan") || can(user.role, "integrasi"))) return new Response("Tidak diizinkan", { status: 403 });
  const q = new URL(req.url).searchParams.get("p");
  const p: Period = q && q in PERIODS ? (q as Period) : "7";
  const { buffer, filename } = await reportWorkbook(p);
  return new Response(buffer, {
    headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
