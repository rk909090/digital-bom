import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { checkApiKey, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** ERP menandai dokumen sudah diambil/diposting. POST /api/integrasi/posting/<code>/terima */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!(await checkApiKey(req))) return unauthorized();
  const code = decodeURIComponent((await ctx.params).code);
  const p = await db.query.postings.findFirst({ where: eq(t.postings.code, code) });
  if (!p) return Response.json({ error: "Kode tidak ditemukan" }, { status: 404 });
  if (p.status !== "diambil") await db.update(t.postings).set({ status: "diambil", deliveredAt: new Date().toISOString(), lastError: null }).where(eq(t.postings.id, p.id));
  return Response.json({ ok: true, code });
}
