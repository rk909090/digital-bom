import { getUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { recipeTemplateWorkbook, XLSX_TYPE } from "@/lib/excel";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Template impor resep (.xlsx), sudah berisi resep aktif saat ini. */
export async function GET() {
  const user = await getUser();
  if (!user || !can(user.role, "master")) return new Response("Tidak diizinkan", { status: 403 });
  const buffer = await recipeTemplateWorkbook();
  return new Response(buffer, {
    headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="template-resep-${todayISO()}.xlsx"`, "Cache-Control": "no-store" },
  });
}
