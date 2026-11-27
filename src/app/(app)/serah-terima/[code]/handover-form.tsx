"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { confirmHandover } from "@/app/actions/produksi";
import { dateLong, dateTime, num } from "@/lib/format";
import { NumberPadModal } from "@/components/controls";
import { Card, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type D = { code: string; product: string; image: string | null; traySize: number; date: string; sent: number; reject: number; trays: number; loose: number; sender: string; recordedAt: string };

export function HandoverForm({ data, receiver, reasons, initialDone }: { data: D; receiver: string; reasons: string[]; initialDone?: { code: string; exCode: string | null; received: number } }) {
  const [recv, setRecv] = useState(initialDone?.received ?? data.sent);
  const [reason, setReason] = useState("");
  const [pad, setPad] = useState(false);
  const [done, setDone] = useState<{ code: string; exCode: string | null } | null>(initialDone ?? null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const diff = recv - data.sent;

  const submit = () =>
    start(async () => {
      const r = await confirmHandover({ batchCode: data.code, received: recv, reason: diff ? reason : undefined });
      if (!r.ok) return toast(r.error, "bad");
      setDone(r.data!);
    });

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-6 text-center">
        <span className={cx("flex size-24 items-center justify-center rounded-full", done.exCode ? "bg-warn-soft text-warn" : "bg-good-soft text-good")}>
          {done.exCode ? <AlertTriangle className="size-12" /> : <CheckCircle2 className="size-12" />}
        </span>
        <h1 className="text-3xl font-extrabold">Penerimaan dikonfirmasi</h1>
        <p className="text-lg text-ink-2">
          {num(recv)} pcs {data.product} diterima dengan nomor <b className="font-mono">{done.code}</b>.
        </p>
        {done.exCode && <p className="text-warn">Selisih jumlah dicatat ({done.exCode}) dan akan diperiksa supervisor.</p>}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Link href="/serah-terima" className={btn("primary", "xl")}>
            Terima batch lain
          </Link>
          <Link href="/" className={btn("secondary", "xl")}>
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/serah-terima" className="inline-flex items-center gap-1 self-start font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-5" /> Daftar serah terima
      </Link>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand">Serah terima produk jadi</p>
            <p className="font-mono text-xl font-bold">ST-{data.code}</p>
          </div>
          <p className="text-right text-sm text-muted">{dateLong(data.date)}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-white">
            {data.image && <Image src={data.image} alt={data.product} fill sizes="192px" className="object-contain p-2" />}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{data.product}</h1>
            <p className="text-muted">Batch <span className="font-mono font-semibold text-ink-2">{data.code}</span></p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-sunken p-3">
            <dt className="text-sm text-muted">Diserahkan produksi</dt>
            <dd className="text-2xl font-extrabold tnum">{num(data.sent)} pcs</dd>
            <dd className="text-xs text-muted tnum">{data.trays} tray × {data.traySize} + {data.loose}</dd>
          </div>
          <div className="rounded-xl bg-sunken p-3">
            <dt className="text-sm text-muted">Reject (tidak diserahkan)</dt>
            <dd className="text-2xl font-extrabold text-bad tnum">{num(data.reject)} pcs</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-sunken p-3 sm:col-span-1">
            <dt className="text-sm text-muted">Dari</dt>
            <dd className="font-bold">{data.sender}</dd>
            <dd className="text-xs text-muted">{dateTime(data.recordedAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 rounded-2xl border-2 border-brand-line bg-brand-soft p-4">
          <p className="text-lg font-bold">Berapa yang Anda terima?</p>
          <p className="text-sm text-ink-2">Hitung produk fisik. Jika sama, langsung tekan Konfirmasi.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRecv((v) => Math.max(0, v - data.traySize))} className={btn("secondary", "lg")}>− 1 tray</button>
            <button type="button" onClick={() => setRecv((v) => Math.max(0, v - 1))} className={btn("secondary", "lg")} aria-label="Kurangi 1">−1</button>
            <button type="button" onClick={() => setPad(true)} className="h-14 min-w-32 rounded-xl border-2 border-line-strong bg-surface px-4 text-3xl font-extrabold tnum" aria-label={`Jumlah diterima ${recv}. Ketuk untuk mengetik`}>
              {num(recv)}
            </button>
            <button type="button" onClick={() => setRecv((v) => v + 1)} className={btn("secondary", "lg")} aria-label="Tambah 1">+1</button>
            <button type="button" onClick={() => setRecv((v) => v + data.traySize)} className={btn("secondary", "lg")}>+ 1 tray</button>
          </div>
          {diff !== 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft p-3">
              <p className="flex items-center gap-2 font-semibold text-warn">
                <AlertTriangle className="size-5" /> Berbeda {diff > 0 ? "+" : "−"}{Math.abs(diff)} pcs dari yang diserahkan. Pilih alasannya:
              </p>
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={cx("h-11 rounded-full border px-4 font-semibold", reason === r ? "border-ink bg-ink text-white" : "border-line-strong bg-surface")}>
                    {r}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setRecv(data.sent)} className="self-start text-sm font-semibold text-ink-2 underline">
                Kembalikan ke {num(data.sent)}
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted">
          Diterima oleh <b className="text-ink">{receiver}</b>
        </p>
        <button type="button" disabled={pending || (diff !== 0 && !reason)} onClick={submit} className={btn(diff === 0 ? "good" : "primary", "xl")}>
          {pending ? <Loader2 className="size-6 animate-spin" /> : <CheckCircle2 className="size-6" />}
          Konfirmasi penerimaan {num(recv)} pcs
        </button>
      </Card>
      <NumberPadModal open={pad} onClose={() => setPad(false)} title="Jumlah diterima (pcs)" initial={recv} decimal={false} onSubmit={(n) => setRecv(Math.max(0, Math.floor(n)))} />
    </div>
  );
}
