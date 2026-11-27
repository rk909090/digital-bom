import "server-only";
import { like } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/** Nomor dokumen berikutnya: prefix + (nomor tertinggi yang ada + 1). Aman walau ada nomor yang terlewat. */
export async function nextCode(tx: Tx, table: SQLiteTable, col: SQLiteColumn, prefix: string, pad = 2): Promise<string> {
  const rows = (await tx.select({ c: col }).from(table).where(like(col, `${prefix}%`))) as { c: string }[];
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.c.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(pad, "0");
}
