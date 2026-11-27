"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, CheckCircle2, Loader2, Lock, Search } from "lucide-react";
import { closeBatch, resolveException } from "@/app/actions/verifikasi";
import { dateTime, num, pct, pctSigned, weight } from "@/lib/format";
import { variance } from "@/lib/rules";
import { Modal } from "@/components/controls";
import { Card, Pill, Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

export type ExView = {
  id: number; code: string; type: "bahan" | "serah_terima"; status: "terbuka" | "investigasi" | "disetujui";
  batchCode: string; product: string; material: string | null; image: string | null; expected: number; actual: number;
  reason: string | null; createdAt: string; createdBy: string; resolvedBy: string | null; resolvedAt: string | null; note: string | null;
};

export function ExceptionCard({ e }: { e: ExView }) {
  const [mode, setMode] = useState<null | "disetujui" | "investigasi">(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const isMat = e.type === "bahan";
  const v = variance(e.actual, e.expected);
  const tone = e.status === "disetujui" ? "border-l-good" : e.status === "investigasi" ? "border-l-warn" : "border-l-bad";

  const submit = () =>
    start(async () => {
      const r = await resolveException({ id: e.id, decision: mode!, note });
      if (!r.ok) return toast(r.error, "bad");
      toast(mode === "disetujui" ? `${e.code} disetujui.` : `${e.code} ditandai untuk investigasi.`);
      setMode(null);
      setNote("");
      router.refresh();
    });

  return (
    <Card as="article" className={cx("flex flex-col gap-4 border-l-4 p-5", tone)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sunken text-ink-2">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-bold">Bakery Production Agent</p>
          <p className="text-sm text-muted">
            {e.code} · {dateTime(e.createdAt)}
          </p>
        </div>
        {e.status === "terbuka" ? <Pill tone="bad">Perlu diperiksa</Pill> : e.status === "investigasi" ? <Pill tone="warn">Investigasi</Pill> : <Pill tone="good">Disetujui</Pill>}
      </div>

      <div className="flex items-start gap-4">
        <Thumb src={e.image} alt={e.material ?? e.product} size={64} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{isMat ? `Selisih bahan: ${e.material}` : "Selisih jumlah serah terima"}</h3>
          <p className="text-sm text-muted">
            Batch{" "}
            <Link href={`/batch/${e.batchCode}`} className="font-mono font-semibold text-ink-2 underline-offset-2 hover:underline">
              {e.batchCode}
            </Link>{" "}
            · {e.product}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-sunken p-3 text-center">
        <div>
          <dt className="text-sm text-muted">{isMat ? "Standar" : "Diserahkan"}</dt>
          <dd className="text-lg font-bold tnum">{isMat ? weight(e.expected) : `${num(e.expected)} pcs`}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{isMat ? "Aktual" : "Diterima"}</dt>
          <dd className="text-lg font-bold tnum">{isMat ? weight(e.actual) : `${num(e.actual)} pcs`}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Selisih</dt>
          <dd className="text-lg font-extrabold text-bad tnum">{isMat ? pctSigned(v) : `${e.actual - e.expected > 0 ? "+" : "−"}${Math.abs(e.actual - e.expected)} pcs`}</dd>
        </div>
      </dl>

      <p className="text-[15px]">
        <span className="text-muted">Alasan dari {e.createdBy}: </span>
        <b>{e.reason ?? "-"}</b>
      </p>

      {e.status === "disetujui" ? (
        <p className="flex items-start gap-2 text-sm text-good">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Disetujui {e.resolvedBy} · {e.resolvedAt && dateTime(e.resolvedAt)}
          {e.note && <span className="text-ink-2">— {e.note}</span>}
        </p>
      ) : (
        <>
          {e.status === "investigasi" && e.note && (
            <p className="rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn">
              <b>Catatan investigasi ({e.resolvedBy}):</b> {e.note}
            </p>
          )}
          {e.status === "terbuka" && <p className="text-sm font-medium text-ink-2">Mohon Production Supervisor memverifikasi sebelum batch ditutup.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={btn("good", "lg", "flex-1")} onClick={() => setMode("disetujui")}>
              <CheckCircle2 className="size-5" /> Setujui
            </button>
            {e.status === "terbuka" && (
              <button type="button" className={btn("secondary", "lg", "flex-1")} onClick={() => setMode("investigasi")}>
                <Search className="size-5" /> Perlu investigasi
              </button>
            )}
          </div>
        </>
      )}

      <Modal
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode === "disetujui" ? `Setujui ${e.code}?` : `Investigasi ${e.code}`}
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setMode(null)}>
              Batal
            </button>
            <button type="button" className={btn(mode === "disetujui" ? "good" : "primary", "lg")} disabled={pending || (mode === "investigasi" && !note.trim())} onClick={submit}>
              {pending && <Loader2 className="size-5 animate-spin" />}
              {mode === "disetujui" ? "Ya, setujui" : "Simpan catatan"}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="font-semibold">{mode === "disetujui" ? "Catatan (opsional)" : "Apa yang perlu diperiksa?"}</span>
          <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} className="rounded-xl border border-line-strong p-3 text-base" placeholder={mode === "disetujui" ? "mis. Penambahan butter sesuai arahan karena tepung lebih kering" : "mis. Cek kalibrasi timbangan 2"} />
        </label>
      </Modal>
    </Card>
  );
}

export function CloseBatchCard({ b }: { b: { code: string; product: string; image: string | null; target: number; good: number; reject: number; received: number; openEx: number } }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const blocked = b.openEx > 0;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-4">
        <Thumb src={b.image} alt={b.product} size={60} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">{b.product}</p>
          <Link href={`/batch/${b.code}`} className="font-mono text-sm font-semibold text-muted hover:underline">
            {b.code}
          </Link>
        </div>
        {blocked ? <Pill tone="bad">{b.openEx} belum disetujui</Pill> : <Pill tone="good">Lengkap</Pill>}
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-sunken p-3 text-center text-sm">
        <div>
          <dt className="text-muted">Bagus</dt>
          <dd className="text-lg font-bold tnum">{num(b.good)}</dd>
        </div>
        <div>
          <dt className="text-muted">Target</dt>
          <dd className="text-lg font-bold tnum">{pct(b.good / b.target)}</dd>
        </div>
        <div>
          <dt className="text-muted">Diterima</dt>
          <dd className="text-lg font-bold tnum">{num(b.received)}</dd>
        </div>
      </dl>
      {blocked && (
        <p className="flex items-center gap-2 text-sm font-medium text-bad">
          <AlertTriangle className="size-4" /> Setujui semua penyimpangan batch ini sebelum menutup.
        </p>
      )}
      <button type="button" disabled={blocked} onClick={() => setAsk(true)} className={btn("primary", "lg", "w-full")}>
        <Lock className="size-5" /> Tutup batch
      </button>
      <Modal
        open={ask}
        onClose={() => setAsk(false)}
        title={`Tutup batch ${b.code}?`}
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setAsk(false)}>
              Batal
            </button>
            <button
              type="button"
              className={btn("primary", "lg")}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await closeBatch(b.code);
                  if (!r.ok) return toast(r.error, "bad");
                  toast(`Batch ${b.code} ditutup.`);
                  setAsk(false);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-5 animate-spin" />} Ya, tutup batch
            </button>
          </>
        }
      >
        <p>Batch yang sudah ditutup masuk ke laporan final dan tidak bisa diubah lagi.</p>
      </Modal>
    </Card>
  );
}
