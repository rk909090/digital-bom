import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Role } from "@/db/schema";

export const NOTIFY_ROLES: Role[] = ["ppic", "gudang", "operator", "supervisor"];

/** Semua pengaturan beserta nilai bawaan. Disimpan sebagai teks di tabel settings. */
export const DEFAULTS = {
  // Telegram
  "telegram.enabled": "false",
  "telegram.token": "",
  "telegram.chat.ppic": "",
  "telegram.chat.gudang": "",
  "telegram.chat.operator": "",
  "telegram.chat.supervisor": "",
  // WhatsApp gateway (HTTP POST: target, message; header Authorization: token)
  "whatsapp.enabled": "false",
  "whatsapp.url": "",
  "whatsapp.token": "",
  "whatsapp.phone.ppic": "",
  "whatsapp.phone.gudang": "",
  "whatsapp.phone.operator": "",
  "whatsapp.phone.supervisor": "",
  // Integrasi ERP
  "erp.webhook.enabled": "false",
  "erp.webhook.url": "",
  "erp.webhook.secret": "",
  "erp.api.key": "",
  // Aturan Digital Agent
  "rule.weighStaleHours": "3",
  "rule.handoverStaleHours": "2",
  "rule.exceptionStaleHours": "4",
  "rule.achievementMinPct": "95",
  "rule.rejectMaxPct": "2",
  // Laporan harian
  "report.enabled": "true",
  "report.hour": "17",
} as const;

export type SettingKey = keyof typeof DEFAULTS;
export const SECRET_KEYS: SettingKey[] = ["telegram.token", "whatsapp.token", "erp.webhook.secret", "erp.api.key"];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.select().from(t.settings);
  const out = { ...DEFAULTS } as Record<SettingKey, string>;
  for (const r of rows) if (r.key in DEFAULTS) out[r.key as SettingKey] = r.value;
  return out;
}

export async function setSettings(values: Partial<Record<SettingKey, string>>) {
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULTS) || value === undefined) continue;
    const existing = await db.query.settings.findFirst({ where: eq(t.settings.key, key) });
    if (existing) await db.update(t.settings).set({ value, updatedAt: now }).where(eq(t.settings.key, key));
    else await db.insert(t.settings).values({ key, value, updatedAt: now });
  }
}

/** Buat rahasia webhook & kunci API saat pertama kali dibutuhkan. */
export async function ensureSecrets() {
  const s = await getSettings();
  const patch: Partial<Record<SettingKey, string>> = {};
  if (!s["erp.webhook.secret"]) patch["erp.webhook.secret"] = randomBytes(24).toString("hex");
  if (!s["erp.api.key"]) patch["erp.api.key"] = "sbk_" + randomBytes(24).toString("hex");
  if (Object.keys(patch).length) await setSettings(patch);
  return { ...s, ...patch };
}

export function mask(v: string) {
  if (!v) return "";
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const num = (v: string, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
