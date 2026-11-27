"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Snowflake,
} from "lucide-react";
import { freezerIn, freezerOut } from "@/app/actions/wip";
import { dateShort, dateTime, num, weight } from "@/lib/format";
import { Modal, NumberPadModal } from "@/components/controls";
import {
  Card,
  Empty,
  PageHeader,
  Pill,
  SectionTitle,
  Thumb,
  btn,
} from "@/components/ui";
import { useToast } from "@/components/toast";

type Ready = {
  code: string;
  date: string;
  product: string;
  image: string | null;
  target: number;
  kg: number;
  lines: number;
  at: string;
};
type Inside = {
  code: string;
  date: string;
  product: string;
  image: string | null;
  target: number;
  kg: number;
  at: string;
  by: string;
};
type Hist = {
  code: string;
  product: string;
  kg: number;
  inAt: string | null;
  outAt: string;
  by: string;
};

/** "3 jam" / "2 hari" sejak waktu tertentu (now dikirim dari server agar render tetap murni). */
function since(now: number, iso: string) {
  const h = Math.max(0, (now - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} menit`;
  if (h < 48) return `${Math.floor(h)} jam`;
  return `${Math.floor(h / 24)} hari`;
}

export function WipView({
  ready,
  inside,
  history,
  now,
}: {
  ready: Ready[];
  inside: Inside[];
  history: Hist[];
  now: number;
}) {
  const [inPad, setInPad] = useState<Ready | null>(null);
  const [out, setOut] = useState<Inside | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const doIn = (b: Ready, kg: number) => {
    setBusy(b.code);
    start(async () => {
      const r = await freezerIn({ batchCode: b.code, doughKg: kg });
      setBusy(null);
      if (!r.ok) return toast(r.error, "bad");
      toast(`Adonan ${b.code} (${weight(kg)}) masuk freezer.`);
    });
  };
  const doOut = (b: Inside) =>
    start(async () => {
      const r = await freezerOut(b.code);
      if (!r.ok) return toast(r.error, "bad");
      setOut(null);
      toast(
        `Adonan ${b.code} keluar freezer. Operator produksi sudah diberi tahu.`,
      );
    });

  return (
    <>
      <PageHeader
        title="Gudang WIP (Freezer)"
        subtitle="Terima adonan yang sudah ditimbang ke freezer, lalu keluarkan saat akan diproduksi."
      />

      <section className="flex flex-col gap-3">
        <SectionTitle
          aside={
            <Pill tone={ready.length ? "warn" : "neutral"}>
              {ready.length} batch
            </Pill>
          }
        >
          Adonan siap masuk freezer
        </SectionTitle>
        {ready.length === 0 ? (
          <Empty
            title="Tidak ada adonan yang menunggu"
            icon={<ArrowDownToLine />}
          >
            Adonan muncul di sini setelah semua bahannya selesai ditimbang.
          </Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {ready.map((b) => (
              <Card key={b.code} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-4">
                  <Thumb src={b.image} alt={b.product} size={60} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight">
                      {b.product}
                    </p>
                    <p className="text-sm text-muted">
                      <Link
                        href={`/batch/${b.code}`}
                        className="font-mono font-semibold text-ink-2 hover:underline"
                      >
                        {b.code}
                      </Link>{" "}
                      · {dateShort(b.date)} · {num(b.target)} pcs
                    </p>
                    <p className="mt-1 text-sm">
                      Ditimbang <b className="tnum">{weight(b.kg)}</b>{" "}
                      <span className="text-muted">
                        ({b.lines} bahan · {since(now, b.at)} lalu)
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={btn("primary", "lg", "w-full")}
                  disabled={pending}
                  onClick={() => setInPad(b)}
                >
                  {busy === b.code ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="size-5" />
                  )}{" "}
                  Masukkan ke freezer
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          aside={
            <Pill tone={inside.length ? "info" : "neutral"}>
              {inside.length} batch
            </Pill>
          }
        >
          Di dalam freezer
        </SectionTitle>
        {inside.length === 0 ? (
          <Empty title="Freezer kosong" icon={<Snowflake />}>
            Belum ada adonan yang disimpan.
          </Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {inside.map((b) => (
              <Card key={b.code} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-4">
                  <Thumb src={b.image} alt={b.product} size={60} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight">
                      {b.product}
                    </p>
                    <p className="text-sm text-muted">
                      <Link
                        href={`/batch/${b.code}`}
                        className="font-mono font-semibold text-ink-2 hover:underline"
                      >
                        {b.code}
                      </Link>{" "}
                      · {num(b.target)} pcs
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                      <b className="tnum">{weight(b.kg)}</b>
                      <span className="text-muted">
                        · masuk {dateTime(b.at)} ({since(now, b.at)}) · {b.by}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={btn("secondary", "lg", "w-full")}
                  disabled={pending}
                  onClick={() => setOut(b)}
                >
                  <ArrowUpFromLine className="size-5" /> Keluarkan untuk
                  produksi
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Riwayat keluar freezer</SectionTitle>
          <Card className="divide-y divide-line">
            {history.map((h) => (
              <div
                key={h.code}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="font-mono font-semibold">{h.code}</span>
                <span className="flex-1">{h.product}</span>
                <b className="tnum">{weight(h.kg)}</b>
                <span className="text-sm text-muted">
                  {h.inAt ? `${dateTime(h.inAt)} → ` : ""}
                  {dateTime(h.outAt)} · {h.by}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <NumberPadModal
        open={!!inPad}
        onClose={() => setInPad(null)}
        title={inPad ? `Berat adonan ${inPad.product} masuk freezer` : ""}
        initial={inPad?.kg ?? 0}
        unit="kg"
        decimal
        onSubmit={(n) => inPad && doIn(inPad, n)}
      />

      <Modal
        open={!!out}
        onClose={() => setOut(null)}
        title="Keluarkan adonan dari freezer?"
        footer={
          <>
            <button
              type="button"
              className={btn("secondary", "lg")}
              onClick={() => setOut(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className={btn("primary", "lg")}
              disabled={pending}
              onClick={() => out && doOut(out)}
            >
              {pending && <Loader2 className="size-5 animate-spin" />} Ya,
              keluarkan
            </button>
          </>
        }
      >
        {out && (
          <p className="text-[17px] leading-relaxed">
            Seluruh adonan <b>{out.product}</b> batch{" "}
            <b className="font-mono">{out.code}</b> (<b>{weight(out.kg)}</b>)
            dikeluarkan untuk diproduksi. Operator produksi akan diberi tahu
            untuk mencatat hasilnya.
          </p>
        )}
      </Modal>
    </>
  );
}
