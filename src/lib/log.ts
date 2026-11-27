import "server-only";
import { db, t } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function logActivity(tx: Tx | typeof db, userId: number, action: string, ref?: string, detail?: string) {
  await tx.insert(t.activity).values({ ts: new Date().toISOString(), userId, action, ref, detail });
}

export function nowISO() {
  return new Date().toISOString();
}
