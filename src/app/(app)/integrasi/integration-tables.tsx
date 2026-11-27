"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Loader2, RefreshCw } from "lucide-react";
import { markPostingTaken, retryPostings } from "@/app/actions/pengaturan";
import { dateTime } from "@/lib/format";
import { Modal } from "@/components/controls";
import { Card, Pill, SectionTitle, btn } from "@/components/ui";
import { useToast } from "@/components/toast";

type P = { id: number; code: string; type: string; ref: string; status: string; attempts: number; lastError: string | null; createdAt: string; deliveredAt: string | null; payload: string };
type O = { id: number; channel: string; role: string; recipient: string; status: string; text: string; lastError: string | null; createdAt: string };

const TYPE_LABEL: Record<string, string> = {
  PENERIMAAN_BAHAN: "Barang masuk",
  PEMAKAIAN_BAHAN: "Pemakaian bahan",
  PENERIMAAN_FG: "Penerimaan FG",
  PENYELESAIAN_PRODUKSI: "Penyelesaian produksi",
};
const ST: Record<string, { label: string; tone: "neutral" | "good" | "bad" | "warn" | "info" }> = {
  menunggu: { label: "Menunggu", tone: "neutral" },
  terkirim: { label: "Terkirim", tone: "good" },
  diambil: { label: "Diambil ERP", tone: "good" },
  gagal: { label: "Gagal", tone: "bad" },
  dilewati: { label: "Kanal mati", tone: "warn" },
};

export function PostingTable({ rows, webhookOn }: { rows: P[]; webhookOn: boolean }) {
  const [sel, setSel] = useState<P | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const pendingCount = rows.filter((r) => r.status === "menunggu" || r.status === "gagal").length;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        aside={
          webhookOn && pendingCount > 0 ? (
            <button type="button" disabled={pending} className={btn("primary", "sm")} onClick={() => start(async () => { const r = await retryPostings(); if (!r.ok) return toast(r.error, "bad"); toast(`${r.data!.sent} dokumen terkirim.`); router.refresh(); })}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Kirim sekarang ({pendingCount})
            </button>
          ) : undefined
        }
      >
        Dokumen posting
      </SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Jenis</th>
              <th className="px-3 py-3 font-semibold">Referensi</th>
              <th className="px-3 py-3 font-semibold">Dibuat</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Keterangan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Belum ada dokumen. Dokumen dibuat saat bahan selesai ditimbang, FG diterima, batch ditutup, atau barang masuk.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold">{TYPE_LABEL[p.type] ?? p.type}</td>
                <td className="px-3 font-mono text-sm">{p.ref}</td>
                <td className="px-3 text-sm text-muted">{dateTime(p.createdAt)}</td>
                <td className="px-3"><Pill tone={ST[p.status]?.tone ?? "neutral"}>{ST[p.status]?.label ?? p.status}</Pill></td>
                <td className="max-w-64 truncate px-3 text-sm text-muted" title={p.lastError ?? ""}>{p.lastError ? `${p.attempts}× gagal: ${p.lastError}` : p.deliveredAt ? dateTime(p.deliveredAt) : "–"}</td>
                <td className="px-4 text-right">
                  <button type="button" className={btn("ghost", "sm")} onClick={() => setSel(p)}><Eye className="size-4" /> Lihat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal
        wide
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `${TYPE_LABEL[sel.type] ?? sel.type} · ${sel.ref}` : ""}
        footer={
          sel && sel.status !== "diambil" && sel.status !== "terkirim" ? (
            <button type="button" className={btn("secondary", "md")} disabled={pending} onClick={() => start(async () => { const r = await markPostingTaken(sel.id); if (!r.ok) return toast(r.error, "bad"); toast("Ditandai sudah diposting manual."); setSel(null); router.refresh(); })}>
              <CheckCircle2 className="size-5" /> Tandai sudah diposting manual
            </button>
          ) : undefined
        }
      >
        {sel && <pre className="max-h-[60vh] overflow-auto rounded-xl bg-sunken p-4 text-xs leading-relaxed">{JSON.stringify(JSON.parse(sel.payload), null, 2)}</pre>}
      </Modal>
    </section>
  );
}

export function OutboxTable({ rows }: { rows: O[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Riwayat pesan Telegram / WhatsApp</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Waktu</th>
              <th className="px-3 py-3 font-semibold">Kanal</th>
              <th className="px-3 py-3 font-semibold">Untuk</th>
              <th className="px-3 py-3 font-semibold">Pesan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Belum ada pesan. Aktifkan Telegram atau WhatsApp di Pengaturan; notifikasi di aplikasi tetap berjalan.</td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-sm text-muted">{dateTime(o.createdAt)}</td>
                <td className="px-3 capitalize">{o.channel}</td>
                <td className="px-3 text-sm">{o.role} · {o.recipient}</td>
                <td className="max-w-80 truncate px-3 text-sm" title={o.text}>{o.text.split("\n")[0]}</td>
                <td className="px-4" title={o.lastError ?? ""}><Pill tone={ST[o.status]?.tone ?? "neutral"}>{ST[o.status]?.label ?? o.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
