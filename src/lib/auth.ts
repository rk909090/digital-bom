import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { can, type Area } from "./access";

export const SESSION_COOKIE = "sb_session";
const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET wajib diisi di produksi");
const key = new TextEncoder().encode(secret ?? "dev-only-secret-change-me-0123456789");

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(key);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const uid = Number(payload.uid);
    const user = await db.query.users.findFirst({ where: eq(t.users.id, uid) });
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, role: user.role, title: user.title, color: user.color };
  } catch {
    return null;
  }
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/** Untuk halaman: arahkan ke login / beranda jika tidak berhak. */
export async function requireUser(area?: Area): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/masuk");
  if (area && !can(user.role, area)) redirect("/?ditolak=1");
  return user;
}

/** Untuk server action: lempar error yang bisa ditampilkan. */
export async function actionUser(area?: Area): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new ActionError("Sesi habis. Silakan masuk lagi.");
  if (area && !can(user.role, area)) throw new ActionError("Anda tidak punya akses untuk tindakan ini.");
  return user;
}

export class ActionError extends Error {}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Bungkus server action agar selalu mengembalikan pesan yang ramah. */
export async function safe<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan di server. Coba lagi, atau hubungi admin." };
  }
}
