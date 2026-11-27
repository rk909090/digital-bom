import Link from "next/link";
import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { Download, FileSpreadsheet, Settings } from "lucide-react";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader, Pill, btn } from "@/components/ui";
import { PostingTable, OutboxTable } from "./integration-tables";

export const metadata: Metadata = { title: "Integrasi ERP" };

export default async function IntegrationPage() {
  await requireUser("integrasi");
  const [s, postings, outbox, counts] = await Promise.all([
    getSettings(),
    db.query.postings.findMany({ orderBy: desc(t.postings.id), limit: 60 }),
    db.query.outbox.findMany({ orderBy: desc(t.outbox.id), limit: 30 }),
    db.select({ status: t.postings.status, n: sql<number>`count(*)` }).from(t.postings).groupBy(t.postings.status),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, Number(x.n)])) as Record<string, number>;
  const webhookOn = s["erp.webhook.enabled"] === "true" && !!s["erp.webhook.url"];
  return (
    <>
      <PageHeader
        title="Integrasi ERP"
        subtitle="Auto-posting: setiap transaksi produksi menjadi dokumen yang dikirim ke ERP (webhook) atau diambil ERP lewat API."
        actions={
          <>
            <a href="/integrasi/ekspor?format=csv" className={btn("secondary", "md")}><Download className="size-5" /> CSV</a>
            <a href="/integrasi/ekspor?format=json" className={btn("secondary", "md")}><Download className="size-5" /> JSON</a>
            <Link href="/pengaturan" className={btn("ghost", "md")}><Settings className="size-5" /> Pengaturan</Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Menunggu" n={c.menunggu ?? 0} tone="neutral" />
        <Stat label="Terkirim ke webhook" n={c.terkirim ?? 0} tone="good" />
        <Stat label="Diambil ERP (API)" n={c.diambil ?? 0} tone="good" />
        <Stat label="Gagal, dicoba ulang" n={c.gagal ?? 0} tone={c.gagal ? "bad" : "neutral"} />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        Webhook ERP: {webhookOn ? <Pill tone="good">Aktif</Pill> : <Pill tone="warn">Belum diaktifkan</Pill>}
        {!webhookOn && "Dokumen tetap tersimpan dan bisa diambil lewat API atau diunduh."}
      </p>
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card md:flex-row md:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-good-soft text-good">
          <FileSpreadsheet className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Ekspor spreadsheet (Excel) untuk ERP</h2>
          <p className="text-sm text-muted">Selama ERP belum terhubung otomatis, data bisa diunduh sebagai .xlsx: Ringkasan, Batch, Pemakaian Bahan, WIP Freezer, Hasil &amp; Reject, Pengiriman FG, Produktivitas, Stok Bahan, dan Posting ERP. Kolomnya sama dengan dokumen posting, sehingga siap diimpor ke ERP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["hari", "7", "30"] as const).map((k) => (
            <a key={k} href={`/laporan/excel?p=${k}`} className={btn("secondary", "md")}>
              <Download className="size-5" /> {k === "hari" ? "Hari ini" : `${k} hari`}
            </a>
          ))}
        </div>
      </section>
      <PostingTable
        webhookOn={webhookOn}
        rows={postings.map((p) => ({ id: p.id, code: p.code, type: p.type, ref: p.ref, status: p.status, attempts: p.attempts, lastError: p.lastError, createdAt: p.createdAt, deliveredAt: p.deliveredAt, payload: p.payload }))}
      />
      <OutboxTable rows={outbox.map((o) => ({ id: o.id, channel: o.channel, role: o.role, recipient: o.recipient, status: o.status, text: o.text, lastError: o.lastError, createdAt: o.createdAt }))} />
    </>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone: "good" | "bad" | "neutral" }) {
  const c = { good: "text-good", bad: "text-bad", neutral: "text-ink" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={`text-3xl font-extrabold tnum ${c}`}>{n}</p>
    </div>
  );
}
