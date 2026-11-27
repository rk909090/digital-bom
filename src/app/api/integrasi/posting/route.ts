import { and, asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { POSTING_STATUS, POSTING_TYPES } from "@/db/schema";
import { checkApiKey, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Daftar dokumen posting untuk ERP.
 * GET /api/integrasi/posting?status=menunggu,gagal&type=PEMAKAIAN_BAHAN&limit=100
 */
export async function GET(req: Request) {
  if (!(await checkApiKey(req))) return unauthorized();
  const q = new URL(req.url).searchParams;
  const statuses = (q.get("status") ?? "menunggu,gagal").split(",").filter((s): s is (typeof POSTING_STATUS)[number] => (POSTING_STATUS as readonly string[]).includes(s));
  const type = q.get("type");
  const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 100));
  const rows = await db.query.postings.findMany({
    where: and(statuses.length ? inArray(t.postings.status, statuses) : undefined, type && (POSTING_TYPES as readonly string[]).includes(type) ? eq(t.postings.type, type as (typeof POSTING_TYPES)[number]) : undefined),
    orderBy: asc(t.postings.id),
    limit,
  });
  return Response.json({ count: rows.length, data: rows.map((r) => ({ code: r.code, type: r.type, status: r.status, created_at: r.createdAt, payload: JSON.parse(r.payload) })) });
}
