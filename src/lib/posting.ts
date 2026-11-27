import "server-only";
import { createHmac } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db, t } from "@/db";
import type { POSTING_TYPES } from "@/db/schema";
import { getSettings } from "./settings";

type PostingType = (typeof POSTING_TYPES)[number];
const RETRY_MIN = [1, 5, 15, 60];
const MAX_ATTEMPTS = 10;

/** Buat dokumen posting ERP. Kode = jenis + referensi (idempoten: dibuat sekali saja). */
export async function createPosting(type: PostingType, ref: string, payload: Record<string, unknown>) {
  const code = `${type}:${ref}`;
  try {
    const exists = await db.query.postings.findFirst({ where: eq(t.postings.code, code) });
    if (exists) return exists.code;
    const now = new Date().toISOString();
    const body = { code, type, ref, created_at: now, source: "smart-bakery", ...payload };
    await db.insert(t.postings).values({ code, type, ref, payload: JSON.stringify(body), status: "menunggu", createdAt: now });
    return code;
  } catch (e) {
    console.error("[posting] gagal membuat", code, e);
    return null;
  }
}

export function sign(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** Kirim posting yang menunggu ke webhook ERP (jika aktif). Satu proses pada satu waktu. */
export async function deliverPostings(limit = 30, force = false): Promise<number> {
  const lock = (globalThis as unknown as { __sbPosting?: { busy: boolean; again: boolean } }).__sbPosting ??= { busy: false, again: false };
  if (lock.busy) {
    lock.again = true;
    return 0;
  }
  lock.busy = true;
  try {
    return await deliverOnce(limit, force);
  } finally {
    lock.busy = false;
    if (lock.again) {
      lock.again = false;
      setTimeout(() => deliverPostings(limit).catch((e) => console.error("[posting]", e)), 0);
    }
  }
}

async function deliverOnce(limit: number, force: boolean) {
  const s = await getSettings();
  if (s["erp.webhook.enabled"] !== "true" || !s["erp.webhook.url"] || !s["erp.webhook.secret"]) return 0;
  const now = new Date().toISOString();
  const due = await db.query.postings.findMany({
    where: and(
      inArray(t.postings.status, ["menunggu", "gagal"]),
      force ? undefined : or(isNull(t.postings.nextAttemptAt), lte(t.postings.nextAttemptAt, now)),
    ),
    orderBy: asc(t.postings.id),
    limit,
  });
  let ok = 0;
  for (const p of due) {
    if (p.attempts >= MAX_ATTEMPTS && !force) continue;
    try {
      const res = await fetch(s["erp.webhook.url"], {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-SmartBakery-Event": p.type, "X-SmartBakery-Code": p.code, "X-SmartBakery-Signature": sign(s["erp.webhook.secret"], p.payload) },
        body: p.payload,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      await db.update(t.postings).set({ status: "terkirim", attempts: p.attempts + 1, deliveredAt: new Date().toISOString(), lastError: null, nextAttemptAt: null }).where(eq(t.postings.id, p.id));
      ok++;
    } catch (e) {
      const attempts = p.attempts + 1;
      const wait = RETRY_MIN[Math.min(attempts - 1, RETRY_MIN.length - 1)];
      await db
        .update(t.postings)
        .set({ status: "gagal", attempts, lastError: (e as Error).message.slice(0, 300), nextAttemptAt: new Date(Date.now() + wait * 60_000).toISOString() })
        .where(eq(t.postings.id, p.id));
    }
  }
  return ok;
}
