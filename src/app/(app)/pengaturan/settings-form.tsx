"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bot, Copy, FileText, Gauge, KeyRound, Loader2, Mail, MessageCircle, Play, Save, Send, Sparkles, Truck, Webhook } from "lucide-react";
import { makeDailyReport, regenerate, runAgentNow, saveSettings, testChannel, testWebhook } from "@/app/actions/pengaturan";
import { dateTime } from "@/lib/format";
import { Card, Pill, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type V = Record<string, string>;
type Run = { id: number; startedAt: string; trigger: string; alerts: number; sent: number; posted: number; note: string | null };
const ROLES = [
  ["supervisor", "Supervisor"],
  ["ppic", "PPIC"],
  ["gudang", "Gudang RM"],
  ["gudang_wip", "Gudang WIP"],
  ["operator", "Operator Produksi"],
  ["packing", "Packing FG"],
] as const;

export function SettingsForm({ values, masked, aiReady, aiLabel, runs }: { values: V; masked: V; aiReady: boolean; aiLabel: string; runs: Run[] }) {
  const [v, setV] = useState<V>(values);
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: (d: unknown) => string) => {
    setBusy(id);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) return toast(r.error ?? "Gagal", "bad");
      toast(ok(r.data));
      router.refresh();
    });
  };
  const save = (id: string, keys: string[]) => run(id, () => saveSettings(Object.fromEntries(keys.map((k) => [k, v[k] ?? ""]))), () => "Pengaturan tersimpan.");

  return (
    <div className="flex flex-col gap-5">
      {/* Agent */}
      <Section icon={<Bot />} title="Digital Agent" desc="Berjalan otomatis setiap 5 menit: memantau penyimpangan, mengirim notifikasi, dan mengirim posting ke ERP.">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn("primary", "md")} disabled={busy === "agent"} onClick={() => run("agent", runAgentNow, (d) => { const r = d as { alerts: number; sent: number; posted: number }; return `Selesai: ${r.alerts} peringatan baru, ${r.sent} pesan terkirim, ${r.posted} posting terkirim.`; })}>
            {busy === "agent" ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />} Jalankan sekarang
          </button>
          <Pill tone={aiReady ? "good" : "warn"}>
            <Sparkles className="size-3.5" /> {aiReady ? `AI aktif: ${aiLabel}` : "AI belum aktif"}
          </Pill>
        </div>
        {!aiReady && <p className="text-sm text-muted">Isi <code className="rounded bg-sunken px-1">OPENROUTER_API_KEY</code> atau <code className="rounded bg-sunken px-1">ANTHROPIC_API_KEY</code> di environment server lalu mulai ulang aplikasi. Sampai saat itu laporan memakai ringkasan template dan hitung kamera tidak tersedia.</p>}
        {runs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line bg-sunken text-left text-muted"><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pemicu</th><th className="px-3 py-2 text-right">Peringatan</th><th className="px-3 py-2 text-right">Pesan</th><th className="px-3 py-2 text-right">Posting</th><th className="px-3 py-2">Catatan</th></tr></thead>
              <tbody>{runs.map((r) => <tr key={r.id} className="border-b border-line last:border-0"><td className="px-3 py-2">{dateTime(r.startedAt)}</td><td className="px-3 py-2">{r.trigger}</td><td className="px-3 py-2 text-right tnum">{r.alerts}</td><td className="px-3 py-2 text-right tnum">{r.sent}</td><td className="px-3 py-2 text-right tnum">{r.posted}</td><td className="px-3 py-2 text-muted">{r.note ?? "–"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Telegram */}
      <Section icon={<Send />} title="Notifikasi Telegram" desc="Gratis. Buat bot lewat @BotFather, masukkan tokennya, lalu isi Chat ID grup/orang untuk tiap peran." toggle={<Toggle id="tg-on" on={v["telegram.enabled"] === "true"} set={(b) => set("telegram.enabled", String(b))} />}>
        <Field label="Token bot">
          <input id="tg-token" type="password" autoComplete="off" value={v["telegram.token"]} onChange={(e) => set("telegram.token", e.target.value)} placeholder={masked["telegram.token"] || "123456:ABC-…"} className={inp} />
        </Field>
        <RoleGrid>
          {ROLES.map(([r, label]) => (
            <RoleRow key={r} label={label}>
              <input id={`tg-${r}`} value={v[`telegram.chat.${r}`]} onChange={(e) => set(`telegram.chat.${r}`, e.target.value)} placeholder="Chat ID, mis. -1001234567890" className={inp} />
              <button type="button" className={btn("secondary", "md")} disabled={busy === `tg-${r}`} onClick={() => run(`tg-${r}`, () => testChannel("telegram", r), () => `Pesan tes terkirim ke ${label}.`)}>Tes</button>
            </RoleRow>
          ))}
        </RoleGrid>
        <Actions>
          <SaveBtn busy={busy === "tg"} onClick={() => save("tg", ["telegram.enabled", "telegram.token", ...ROLES.map(([r]) => `telegram.chat.${r}`)])} />
        </Actions>
      </Section>

      {/* WhatsApp */}
      <Section icon={<MessageCircle />} title="Notifikasi WhatsApp" desc="Lewat layanan gateway WhatsApp pilihan Anda (berbayar). Sistem mengirim POST berisi target & message dengan header Authorization." toggle={<Toggle id="wa-on" on={v["whatsapp.enabled"] === "true"} set={(b) => set("whatsapp.enabled", String(b))} />}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="URL kirim pesan gateway"><input id="wa-url" value={v["whatsapp.url"]} onChange={(e) => set("whatsapp.url", e.target.value)} placeholder="https://…/send" className={inp} /></Field>
          <Field label="Token gateway"><input id="wa-token" type="password" autoComplete="off" value={v["whatsapp.token"]} onChange={(e) => set("whatsapp.token", e.target.value)} placeholder={masked["whatsapp.token"] || "token"} className={inp} /></Field>
        </div>
        <RoleGrid>
          {ROLES.map(([r, label]) => (
            <RoleRow key={r} label={label}>
              <input id={`wa-${r}`} inputMode="tel" value={v[`whatsapp.phone.${r}`]} onChange={(e) => set(`whatsapp.phone.${r}`, e.target.value)} placeholder="628123456789 (pisahkan koma)" className={inp} />
              <button type="button" className={btn("secondary", "md")} disabled={busy === `wa-${r}`} onClick={() => run(`wa-${r}`, () => testChannel("whatsapp", r), () => `Pesan tes terkirim ke ${label}.`)}>Tes</button>
            </RoleRow>
          ))}
        </RoleGrid>
        <Actions>
          <SaveBtn busy={busy === "wa"} onClick={() => save("wa", ["whatsapp.enabled", "whatsapp.url", "whatsapp.token", ...ROLES.map(([r]) => `whatsapp.phone.${r}`)])} />
        </Actions>
      </Section>

      {/* Email (Resend) */}
      <Section icon={<Mail />} title="Notifikasi Email (Resend)" desc="Notifikasi dan laporan harian dikirim lewat email memakai layanan Resend (resend.com). Kolom sudah disiapkan; isi API key dan alamat pengirim saat akun Resend siap." toggle={<Toggle id="em-on" on={v["email.enabled"] === "true"} set={(b) => set("email.enabled", String(b))} />}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="API key Resend" hint="Dibuat di dashboard Resend → API Keys. Disimpan tersembunyi.">
            <input id="em-key" type="password" autoComplete="off" value={v["email.resend.key"]} onChange={(e) => set("email.resend.key", e.target.value)} placeholder={masked["email.resend.key"] || "re_…"} className={inp} />
          </Field>
          <Field label="Alamat pengirim" hint="Domainnya harus sudah diverifikasi di Resend.">
            <input id="em-from" value={v["email.from"]} onChange={(e) => set("email.from", e.target.value)} placeholder="Smart Bakery <notifikasi@domainanda.com>" className={inp} />
          </Field>
        </div>
        <RoleGrid>
          {ROLES.map(([r, label]) => (
            <RoleRow key={r} label={label}>
              <input id={`em-${r}`} type="text" inputMode="email" autoComplete="off" value={v[`email.to.${r}`]} onChange={(e) => set(`email.to.${r}`, e.target.value)} placeholder="nama@perusahaan.com (pisahkan koma)" className={inp} />
              <button type="button" className={btn("secondary", "md")} disabled={busy === `em-${r}`} onClick={() => run(`em-${r}`, () => testChannel("email", r), () => `Email tes terkirim ke ${label}.`)}>Tes</button>
            </RoleRow>
          ))}
        </RoleGrid>
        <Actions>
          <SaveBtn busy={busy === "em"} onClick={() => save("em", ["email.enabled", "email.resend.key", "email.from", ...ROLES.map(([r]) => `email.to.${r}`)])} />
        </Actions>
      </Section>

      {/* Tujuan pengiriman */}
      <Section icon={<Truck />} title="Tujuan pengiriman produk jadi" desc="Pilihan tujuan yang muncul di layar Pengiriman FG (Packing FG). Satu tujuan per baris, mis. Gudang FG atau nama outlet.">
        <Field label="Daftar tujuan">
          <textarea id="fg-dest" rows={4} value={v["fg.destinations"]} onChange={(e) => set("fg.destinations", e.target.value)} className="w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base leading-relaxed" />
        </Field>
        <Actions>
          <SaveBtn busy={busy === "fg"} onClick={() => save("fg", ["fg.destinations"])} />
        </Actions>
      </Section>

      {/* ERP */}
      <Section icon={<Webhook />} title="Integrasi ERP" desc="Dokumen posting (penerimaan bahan, pemakaian bahan, WIP masuk/keluar freezer, pengiriman FG, penyelesaian produksi) dikirim ke webhook ERP dan/atau diambil ERP lewat API. Data juga bisa diekspor ke Excel dari halaman Integrasi ERP atau Laporan." toggle={<Toggle id="erp-on" on={v["erp.webhook.enabled"] === "true"} set={(b) => set("erp.webhook.enabled", String(b))} />}>
        <Field label="URL webhook ERP" hint="Menerima POST JSON. Header X-SmartBakery-Signature = sha256 HMAC dari body dengan rahasia di bawah.">
          <input id="erp-url" value={v["erp.webhook.url"]} onChange={(e) => set("erp.webhook.url", e.target.value)} placeholder="https://erp.perusahaan.co.id/hooks/produksi" className={inp} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">Rahasia webhook:</span>
          <code className="rounded bg-sunken px-2 py-1">{masked["erp.webhook.secret"]}</code>
          <button type="button" className={btn("ghost", "sm")} onClick={() => run("sec", () => regenerate("erp.webhook.secret"), () => "Rahasia webhook diganti. Perbarui juga di ERP.")}><KeyRound className="size-4" /> Ganti</button>
        </div>
        <Actions>
          <SaveBtn busy={busy === "erp"} onClick={() => save("erp", ["erp.webhook.enabled", "erp.webhook.url"])} />
          <button type="button" className={btn("secondary", "md")} disabled={busy === "wh"} onClick={() => run("wh", testWebhook, (d) => `Webhook membalas HTTP ${(d as { status: number }).status}.`)}>
            {busy === "wh" ? <Loader2 className="size-5 animate-spin" /> : <Webhook className="size-5" />} Tes webhook
          </button>
        </Actions>
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-sunken p-4 text-sm">
          <p className="font-semibold">API untuk ERP (tarik data)</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Kunci API:</span>
            <code className="rounded bg-surface px-2 py-1">{apiKey ?? masked["erp.api.key"]}</code>
            {apiKey && (
              <button type="button" className={btn("ghost", "sm")} onClick={() => navigator.clipboard.writeText(apiKey).then(() => toast("Kunci API disalin."), () => toast("Salin manual dari kotak di atas.", "bad"))}>
                <Copy className="size-4" /> Salin
              </button>
            )}
            <button type="button" className={btn("ghost", "sm")} onClick={() => { setBusy("key"); start(async () => { const r = await regenerate("erp.api.key"); setBusy(null); if (!r.ok) return toast(r.error, "bad"); setApiKey(r.data!.value); toast("Kunci API baru dibuat. Simpan sekarang, kunci hanya tampil sekali."); }); }}>
              <KeyRound className="size-4" /> Buat kunci baru
            </button>
          </div>
          <code className="block overflow-x-auto whitespace-pre rounded bg-surface p-3 text-xs">{`GET  /api/integrasi/posting?status=menunggu,gagal\nPOST /api/integrasi/posting/{code}/terima\nPOST /api/agent/jalankan\nHeader: X-API-Key: <kunci>`}</code>
        </div>
      </Section>

      {/* Aturan */}
      <Section icon={<Gauge />} title="Aturan pemantauan" desc="Digital Agent memberi peringatan jika batas ini terlewati.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField id="r1" label="Batch belum selesai ditimbang" unit="jam" v={v["rule.weighStaleHours"]} set={(x) => set("rule.weighStaleHours", x)} />
          <NumField id="r2" label="Adonan belum masuk freezer / produk belum dikirim" unit="jam" v={v["rule.handoverStaleHours"]} set={(x) => set("rule.handoverStaleHours", x)} />
          <NumField id="r3" label="Penyimpangan belum diperiksa" unit="jam" v={v["rule.exceptionStaleHours"]} set={(x) => set("rule.exceptionStaleHours", x)} />
          <NumField id="r4" label="Yield minimal (vs standar output BOM)" unit="%" v={v["rule.achievementMinPct"]} set={(x) => set("rule.achievementMinPct", x)} />
          <NumField id="r5" label="Reject maksimal" unit="%" v={v["rule.rejectMaxPct"]} set={(x) => set("rule.rejectMaxPct", x)} />
        </div>
        <Actions>
          <SaveBtn busy={busy === "rule"} onClick={() => save("rule", ["rule.weighStaleHours", "rule.handoverStaleHours", "rule.exceptionStaleHours", "rule.achievementMinPct", "rule.rejectMaxPct"])} />
        </Actions>
      </Section>

      {/* Laporan */}
      <Section icon={<FileText />} title="Laporan harian otomatis" desc="Dikirim ke Supervisor dan PPIC setiap hari pada jam yang dipilih (WIB), lewat kanal yang aktif (Telegram, WhatsApp, Email)." toggle={<Toggle id="rep-on" on={v["report.enabled"] === "true"} set={(b) => set("report.enabled", String(b))} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField id="rep-h" label="Jam kirim" unit=":00 WIB" v={v["report.hour"]} set={(x) => set("report.hour", x)} />
        </div>
        <Actions>
          <SaveBtn busy={busy === "rep"} onClick={() => save("rep", ["report.enabled", "report.hour"])} />
          <button type="button" className={btn("secondary", "md")} disabled={busy === "mk"} onClick={() => run("mk", makeDailyReport, (d) => ((d as { source: string }).source === "ai" ? "Laporan harian dibuat dengan ringkasan AI dan dikirim." : "Laporan harian dibuat (ringkasan template) dan dikirim."))}>
            {busy === "mk" ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />} Buat & kirim sekarang
          </button>
        </Actions>
      </Section>
    </div>
  );
}

/** Semua kontrol di halaman ini setinggi 44 px (sama dengan tombol ukuran md) agar sejajar. */
const inp = "h-11 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3 text-base";

/** Baris tombol di bagian bawah setiap kartu: rata kiri, tinggi seragam, dipisah garis tipis. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">{children}</div>;
}

function Section({ icon, title, desc, toggle, children }: { icon: ReactNode; title: string; desc: string; toggle?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:size-6">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted">{desc}</p>
        </div>
        {toggle}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ id, on, set }: { id: string; on: boolean; set: (b: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex shrink-0 cursor-pointer items-center gap-2 font-semibold">
      <span className={cx("text-sm", on ? "text-good" : "text-muted")}>{on ? "Aktif" : "Mati"}</span>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} className="peer sr-only" />
      <span className={cx("relative h-7 w-12 rounded-full transition peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-brand", on ? "bg-good" : "bg-line-strong")}>
        <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

function RoleGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 lg:grid-cols-2">{children}</div>;
}

function RoleRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function NumField({ id, label, unit, v, set }: { id: string; label: string; unit: string; v: string; set: (x: string) => void }) {
  return (
    <label htmlFor={id} className="flex h-full flex-col gap-1.5">
      <span className="flex-1 font-semibold leading-snug">{label}</span>
      <span className="flex items-center gap-2">
        <input id={id} inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ""))} className="h-11 w-24 rounded-xl border border-line-strong bg-surface px-3 text-right text-lg font-semibold tnum" />
        <span className="text-muted">{unit}</span>
      </span>
    </label>
  );
}

function SaveBtn({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className={btn("primary", "md")}>
      {busy ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />} Simpan
    </button>
  );
}
