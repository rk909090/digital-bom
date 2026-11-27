"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { actionUser, ActionError, safe } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { DEFAULTS, SECRET_KEYS, getSettings, setSettings, type SettingKey } from "@/lib/settings";
import { sendTelegram, sendWhatsApp } from "@/lib/channels";
import { deliverPostings, sign } from "@/lib/posting";
import { generateDailyReport, runAgent } from "@/lib/agent";
import { aiEnabled } from "@/lib/ai";

export async function saveSettings(values: Partial<Record<SettingKey, string>>) {
  return safe(async () => {
    const user = await actionUser("pengaturan");
    const clean: Partial<Record<SettingKey, string>> = {};
    for (const [k, v] of Object.entries(values)) {
      if (!(k in DEFAULTS) || typeof v !== "string") continue;
      const key = k as SettingKey;
      // nilai rahasia yang tidak diubah dikirim kosong dari form
      if (SECRET_KEYS.includes(key) && v === "") continue;
      if (key.startsWith("rule.") || key === "report.hour") {
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > (key === "report.hour" ? 23 : 1000)) throw new ActionError(`Angka untuk ${key} tidak valid.`);
        clean[key] = String(n);
        continue;
      }
      if (key === "erp.webhook.url" || key === "whatsapp.url") {
        if (v && !/^https?:\/\/\S+$/.test(v.trim())) throw new ActionError("Alamat URL harus diawali http:// atau https://");
      }
      clean[key] = v.trim().slice(0, 500);
    }
    await setSettings(clean);
    await logActivity(db, user.id, "ubah_pengaturan", undefined, Object.keys(clean).filter((k) => !SECRET_KEYS.includes(k as SettingKey)).join(", "));
    revalidatePath("/", "layout");
    return { saved: Object.keys(clean).length };
  });
}

export async function regenerate(key: "erp.webhook.secret" | "erp.api.key") {
  return safe(async () => {
    const user = await actionUser("pengaturan");
    const value = key === "erp.api.key" ? "sbk_" + randomBytes(24).toString("hex") : randomBytes(24).toString("hex");
    await setSettings({ [key]: value });
    await logActivity(db, user.id, "ganti_kunci", key);
    revalidatePath("/pengaturan");
    return { value };
  });
}

export async function testChannel(channel: "telegram" | "whatsapp", role: string) {
  return safe(async () => {
    await actionUser("pengaturan");
    const s = await getSettings();
    const text = `✅ Tes notifikasi Smart Bakery untuk peran ${role}. Jika pesan ini masuk, kanal sudah benar.`;
    try {
      if (channel === "telegram") {
        const chat = s[`telegram.chat.${role}` as SettingKey];
        if (!s["telegram.token"] || !chat) throw new ActionError("Isi token bot dan Chat ID peran ini, lalu simpan dulu.");
        await sendTelegram(s["telegram.token"], chat, text);
      } else {
        const phone = s[`whatsapp.phone.${role}` as SettingKey];
        if (!s["whatsapp.url"] || !s["whatsapp.token"] || !phone) throw new ActionError("Isi URL gateway, token, dan nomor peran ini, lalu simpan dulu.");
        await sendWhatsApp(s["whatsapp.url"], s["whatsapp.token"], phone, text);
      }
    } catch (e) {
      if (e instanceof ActionError) throw e;
      throw new ActionError(`Gagal mengirim: ${(e as Error).message}`);
    }
    return { ok: true };
  });
}

export async function testWebhook() {
  return safe(async () => {
    await actionUser("pengaturan");
    const s = await getSettings();
    if (!s["erp.webhook.url"] || !s["erp.webhook.secret"]) throw new ActionError("Isi URL webhook dan simpan dulu.");
    const body = JSON.stringify({ code: "TES", type: "TES", created_at: new Date().toISOString(), source: "smart-bakery" });
    try {
      const res = await fetch(s["erp.webhook.url"], {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-SmartBakery-Event": "TES", "X-SmartBakery-Code": "TES", "X-SmartBakery-Signature": sign(s["erp.webhook.secret"], body) },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new ActionError(`Webhook membalas HTTP ${res.status}.`);
      return { status: res.status };
    } catch (e) {
      if (e instanceof ActionError) throw e;
      throw new ActionError(`Webhook tidak bisa dihubungi: ${(e as Error).message}`);
    }
  });
}

export async function runAgentNow() {
  return safe(async () => {
    const user = await actionUser("pengaturan");
    const r = await runAgent(`manual:${user.name}`);
    revalidatePath("/", "layout");
    if (r.skipped) throw new ActionError("Digital Agent sedang berjalan. Coba lagi sebentar.");
    return r;
  });
}

export async function makeDailyReport() {
  return safe(async () => {
    await actionUser("laporan");
    const r = await generateDailyReport({ notifyRoles: true });
    revalidatePath("/", "layout");
    return { ...r, aiReady: aiEnabled() };
  });
}

export async function retryPostings(ids?: number[]) {
  return safe(async () => {
    await actionUser("integrasi");
    const s = await getSettings();
    if (s["erp.webhook.enabled"] !== "true" || !s["erp.webhook.url"]) throw new ActionError("Webhook ERP belum diaktifkan di Pengaturan.");
    if (ids?.length) await db.update(t.postings).set({ nextAttemptAt: null }).where(inArray(t.postings.id, ids));
    const n = await deliverPostings(100, true);
    revalidatePath("/integrasi");
    return { sent: n };
  });
}

export async function markPostingTaken(id: number) {
  return safe(async () => {
    const user = await actionUser("integrasi");
    const p = await db.query.postings.findFirst({ where: eq(t.postings.id, id) });
    if (!p) throw new ActionError("Dokumen tidak ditemukan.");
    await db.update(t.postings).set({ status: "diambil", deliveredAt: new Date().toISOString(), lastError: null }).where(eq(t.postings.id, id));
    await logActivity(db, user.id, "posting_manual", p.code);
    revalidatePath("/integrasi");
    return { code: p.code };
  });
}
