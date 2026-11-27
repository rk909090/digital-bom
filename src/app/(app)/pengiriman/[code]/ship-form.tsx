"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, Loader2, ShieldCheck, Store, Truck, Warehouse } from "lucide-react";
import { shipFinishedGoods } from "@/app/actions/produksi";
import { dateLong, dateTime, num } from "@/lib/format";
import { Card, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type D = { code: string; product: string; image: string | null; traySize: number; date: string; qty: number; reject: number; trays: number; loose: number; recorder: string; recordedAt: string };
type Done = { code: string; qty: number; destination: string };

export function ShipForm({ data, sender, destinations, initialDone }: { data: D; sender: string; destinations: string[]; initialDone?: Done }) {
  const [dest, setDest] = useState(destinations.length === 1 ? destinations[0] : "");
  const [done, setDone] = useState<Done | null>(initialDone ?? null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = () =>
    start(async () => {
      const r = await shipFinishedGoods({ batchCode: data.code, destination: dest });
      if (!r.ok) return toast(r.error, "bad");
      setDone(r.data!);
    });

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-6 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-good-soft text-good">
          <CheckCircle2 className="size-12" />
        </span>
        <h1 className="text-3xl font-extrabold">Pengiriman tercatat</h1>
        <p className="text-lg text-ink-2">
          {num(done.qty)} pcs {data.product} dikirim ke <b>{done.destination}</b> dengan nomor <b className="font-mono">{done.code}</b>.
        </p>
        <p className="flex items-center gap-2 text-muted">
          <ShieldCheck className="size-5 text-good" /> Disetujui otomatis oleh sistem.
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Link href="/pengiriman" className={btn("primary", "xl")}>
            Kirim batch lain
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
      <Link href="/pengiriman" className="inline-flex items-center gap-1 self-start font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-5" /> Daftar pengiriman
      </Link>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand">Pengiriman produk jadi</p>
            <p className="font-mono text-xl font-bold">KRM-{data.code}</p>
          </div>
          <p className="text-right text-sm text-muted">{dateLong(data.date)}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-white">
            {data.image && <Image src={data.image} alt={data.product} fill sizes="160px" className="object-contain p-2" />}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{data.product}</h1>
            <p className="text-muted">
              Batch <span className="font-mono font-semibold text-ink-2">{data.code}</span>
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-sunken p-3">
            <dt className="text-sm text-muted">Produk bagus dikirim</dt>
            <dd className="text-2xl font-extrabold text-good tnum">{num(data.qty)} pcs</dd>
            <dd className="text-xs text-muted tnum">
              {data.trays} tray × {data.traySize} + {data.loose}
            </dd>
          </div>
          <div className="rounded-xl bg-sunken p-3">
            <dt className="text-sm text-muted">Reject (tidak dikirim)</dt>
            <dd className="text-2xl font-extrabold text-bad tnum">{num(data.reject)} pcs</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-sunken p-3 sm:col-span-1">
            <dt className="text-sm text-muted">Hasil dicatat oleh</dt>
            <dd className="font-bold">{data.recorder}</dd>
            <dd className="text-xs text-muted">{dateTime(data.recordedAt)}</dd>
          </div>
        </dl>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-bold">Kirim ke mana?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {destinations.map((d) => {
              const Icon = /gudang/i.test(d) ? Warehouse : Store;
              const on = dest === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDest(d)}
                  aria-pressed={on}
                  className={cx("flex h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-bold transition-colors", on ? "border-brand bg-brand-soft text-ink" : "border-line-strong bg-surface hover:border-ink-2")}
                >
                  <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-brand text-white" : "bg-sunken text-ink-2")}>
                    <Icon className="size-5" />
                  </span>
                  {d}
                  {on && <CheckCircle2 className="ml-auto size-6 text-brand" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="flex items-start gap-2 rounded-xl bg-sunken p-3 text-sm text-ink-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-good" />
          <span>
            Jumlah mengikuti hasil produksi yang tercatat dan disetujui otomatis oleh sistem. Dikirim oleh <b className="text-ink">{sender}</b>.
          </span>
        </p>
        <button type="button" disabled={pending || !dest} onClick={submit} className={btn("primary", "xl")}>
          {pending ? <Loader2 className="size-6 animate-spin" /> : <Truck className="size-6" />}
          {dest ? `Kirim ${num(data.qty)} pcs ke ${dest}` : "Pilih tujuan dulu"}
        </button>
      </Card>
    </div>
  );
}
