import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db, t } from "@/db";
import { getSettings, type SettingKey } from "./settings";

/** Kirim teks lewat Telegram Bot API. */
export async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${body.slice(0, 160)}`);
}

/**
 * Kirim lewat gateway WhatsApp berbasis HTTP (format umum gateway lokal):
 * POST <url>, header Authorization: <token>, body form `target` & `message`.
 */
export async function sendWhatsApp(url: string, token: string, phone: string, text: string) {
  const form = new URLSearchParams({ target: phone, message: text });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${body.slice(0, 160)}`);
  // Banyak gateway membalas 200 dengan {"status": false} saat gagal
  if (/"status"\s*:\s*false/.test(body)) throw new Error(`WhatsApp ditolak gateway: ${body.slice(0, 160)}`);
}

/**
 * Kirim email lewat Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Teks notifikasi: baris pertama = subjek, sisanya = isi.
 * RESEND_API_URL hanya untuk pengujian (default API resmi Resend).
 */
export async function sendEmail(apiKey: string, from: string, to: string, text: string) {
  const [first, ...rest] = text.split("\n");
  const subject = first.replace(/^\S+\s/, "").trim() || "Notifikasi Smart Bakery"; // buang ikon di depan judul
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `[Smart Bakery] ${subject}`, text: [subject, "", ...rest].join("\n") }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Email (Resend) ${res.status}: ${body.slice(0, 160)}`);
}

/** Tambahkan pesan ke kotak keluar untuk peran-peran yang dituju. */
export async function enqueueChannels(notificationId: number, roles: string[], text: string) {
  const s = await getSettings();
  const now = new Date().toISOString();
  const rows: (typeof t.outbox.$inferInsert)[] = [];
  for (const role of roles) {
    if (s["telegram.enabled"] === "true")
      for (const chat of split(s[`telegram.chat.${role}` as SettingKey])) rows.push({ notificationId, channel: "telegram", recipient: chat, role, text, status: "menunggu", createdAt: now });
    if (s["whatsapp.enabled"] === "true")
      for (const phone of split(s[`whatsapp.phone.${role}` as SettingKey])) rows.push({ notificationId, channel: "whatsapp", recipient: phone, role, text, status: "menunggu", createdAt: now });
    if (s["email.enabled"] === "true")
      for (const email of split(s[`email.to.${role}` as SettingKey])) rows.push({ notificationId, channel: "email", recipient: email, role, text, status: "menunggu", createdAt: now });
  }
  if (rows.length) await db.insert(t.outbox).values(rows);
  return rows.length;
}

/** Kirim isi kotak keluar yang masih menunggu (dicoba maks 5 kali). Satu proses pada satu waktu. */
export async function dispatchOutbox(limit = 30): Promise<number> {
  const lock = (globalThis as unknown as { __sbOutbox?: { busy: boolean; again: boolean } }).__sbOutbox ??= { busy: false, again: false };
  if (lock.busy) {
    lock.again = true;
    return 0;
  }
  lock.busy = true;
  try {
    return await dispatchOnce(limit);
  } finally {
    lock.busy = false;
    if (lock.again) {
      lock.again = false;
      setTimeout(() => dispatchOutbox(limit).catch((e) => console.error("[outbox]", e)), 0);
    }
  }
}

async function dispatchOnce(limit: number) {
  const s = await getSettings();
  const pending = await db.query.outbox.findMany({ where: and(inArray(t.outbox.status, ["menunggu", "gagal"]), lt(t.outbox.attempts, 5)), limit });
  let sent = 0;
  for (const m of pending) {
    try {
      if (m.channel === "telegram") {
        if (s["telegram.enabled"] !== "true" || !s["telegram.token"]) throw new SkipError("Telegram belum diaktifkan");
        await sendTelegram(s["telegram.token"], m.recipient, m.text);
      } else if (m.channel === "whatsapp") {
        if (s["whatsapp.enabled"] !== "true" || !s["whatsapp.url"] || !s["whatsapp.token"]) throw new SkipError("WhatsApp belum diaktifkan");
        await sendWhatsApp(s["whatsapp.url"], s["whatsapp.token"], m.recipient, m.text);
      } else {
        if (s["email.enabled"] !== "true" || !s["email.resend.key"] || !s["email.from"]) throw new SkipError("Email belum diaktifkan");
        await sendEmail(s["email.resend.key"], s["email.from"], m.recipient, m.text);
      }
      await db.update(t.outbox).set({ status: "terkirim", attempts: m.attempts + 1, sentAt: new Date().toISOString(), lastError: null }).where(eq(t.outbox.id, m.id));
      sent++;
    } catch (e) {
      const skip = e instanceof SkipError;
      await db
        .update(t.outbox)
        .set({ status: skip ? "dilewati" : "gagal", attempts: m.attempts + 1, lastError: (e as Error).message.slice(0, 300) })
        .where(eq(t.outbox.id, m.id));
    }
  }
  return sent;
}

class SkipError extends Error {}

const split = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
