"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { createSession, destroySession, getUser } from "@/lib/auth";
import { verifyPin } from "@/lib/pin";
import { logActivity } from "@/lib/log";

const attempts = new Map<number, { n: number; until: number }>();

export async function login(userId: number, pin: string): Promise<{ ok: false; error: string } | { ok: true }> {
  const lock = attempts.get(userId);
  if (lock && lock.until > Date.now()) {
    return { ok: false, error: "Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi." };
  }
  const user = await db.query.users.findFirst({ where: eq(t.users.id, userId) });
  if (!user || !user.active || !/^\d{4}$/.test(pin) || !verifyPin(pin, user.pinHash)) {
    const a = attempts.get(userId) ?? { n: 0, until: 0 };
    a.n += 1;
    if (a.n >= 5) {
      a.n = 0;
      a.until = Date.now() + 60_000;
    }
    attempts.set(userId, a);
    return { ok: false, error: "PIN salah. Coba lagi." };
  }
  attempts.delete(userId);
  await createSession(user.id);
  await logActivity(db, user.id, "masuk");
  return { ok: true };
}

export async function logout() {
  const u = await getUser();
  if (u) await logActivity(db, u.id, "keluar");
  await destroySession();
  redirect("/masuk");
}
