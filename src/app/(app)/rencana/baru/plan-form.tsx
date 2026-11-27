"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Layers } from "lucide-react";
import { createPlan } from "../../../actions/plan";
import { splitBatches, stdQty } from "@/lib/rules";
import { dateLong, num, weight } from "@/lib/format";
import { NumberPadModal } from "@/components/controls";
import { Card, Pill, Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type P = { id: number; code: string; name: string; image: string | null; traySize: number; baseQty: number; version: number; lines: { materialId: number; qty: number }[] };
type M = { id: number; name: string; image: string | null; stock: number; tracked: boolean; available: number | null };

export function PlanForm({ products, materials, today, tomorrow }: { products: P[]; materials: M[]; today: string; tomorrow: string }) {
  const [pid, setPid] = useState<number | null>(null);
  const [qty, setQty] = useState(0);
  const [date, setDate] = useState(today);
  const [pad, setPad] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const p = products.find((x) => x.id === pid);

  const calc = useMemo(() => {
    if (!p || qty <= 0) return null;
    const sizes = splitBatches(qty, p.baseQty);
    const rows = p.lines.map((l) => {
      const m = materials.find((x) => x.id === l.materialId)!;
      const need = stdQty(l.qty, qty, p.baseQty);
      const short = m.available == null ? 0 : Math.max(0, need - m.available);
      return { m, need, short };
    });
    return { sizes, rows, shorts: rows.filter((r) => r.short > 0).length };
  }, [p, qty, materials]);

  const submit = () => {
    if (!p || !calc) return;
    start(async () => {
      const r = await createPlan({ productId: p.id, qty, date });
      if (!r.ok) return toast(r.error, "bad");
      const d = r.data!;
      router.push(`/rencana?baru=${d.orderCode}&batch=${d.batchCodes.length}&rq=${d.reqCode}&kurang=${d.shortages}`);
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-6">
        {/* Langkah 1 */}
        <Card className="flex flex-col gap-4 p-5">
          <StepTitle n={1} done={!!p}>Produk apa yang mau dibuat?</StepTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {products.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setPid(x.id);
                  if (!qty) setQty(x.baseQty);
                }}
                aria-pressed={pid === x.id}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-2xl border-2 bg-surface p-3 text-center transition",
                  pid === x.id ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong",
                )}
              >
                <Thumb src={x.image} alt={x.name} size={96} className="border-0 bg-transparent" />
                <span className="font-bold leading-tight">{x.name}</span>
                <span className="text-xs text-muted">1 batch = {num(x.baseQty)} pcs</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Langkah 2 */}
        <Card className={cx("flex flex-col gap-4 p-5 transition", !p && "opacity-50")}>
          <StepTitle n={2} done={qty > 0 && !!p}>Berapa banyak?</StepTitle>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!p} onClick={() => setPad(true)} className="flex h-16 min-w-48 items-baseline justify-between gap-3 rounded-2xl border-2 border-line-strong bg-surface px-5 text-left hover:border-ink-2">
              <span className="text-3xl font-extrabold tnum">{qty ? num(qty) : "0"}</span>
              <span className="text-muted">pcs</span>
            </button>
            {p && (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((k) => (
                  <button key={k} type="button" onClick={() => setQty(p.baseQty * k)} className={btn(qty === p.baseQty * k ? "primary" : "secondary", "md")}>
                    {k} batch · {num(p.baseQty * k)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {p && <p className="text-sm text-muted">Ketuk angka untuk mengetik jumlah lain. Jumlah yang tidak genap akan dibuat sebagai batch terakhir yang lebih kecil.</p>}
        </Card>

        {/* Langkah 3 */}
        <Card className={cx("flex flex-col gap-4 p-5", !p && "opacity-50")}>
          <StepTitle n={3} done>Kapan diproduksi?</StepTitle>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDate(today)} className={btn(date === today ? "primary" : "secondary", "lg")}>
              Hari ini
            </button>
            <button type="button" onClick={() => setDate(tomorrow)} className={btn(date === tomorrow ? "primary" : "secondary", "lg")}>
              Besok
            </button>
            <label className="flex items-center gap-2 text-sm text-muted">
              atau pilih:
              <input type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-14 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink" />
            </label>
          </div>
          <p className="font-semibold">{dateLong(date)}</p>
        </Card>
      </div>

      {/* Ringkasan */}
      <aside className="lg:sticky lg:top-36">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-bold">Kebutuhan bahan</h2>
          {!calc || !p ? (
            <p className="text-muted">Pilih produk dan jumlah. Bahan yang dibutuhkan akan muncul di sini.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
                <Layers className="size-6 text-brand" />
                <p className="text-[15px]">
                  <b>{num(qty)} pcs</b> = <b>{calc.sizes.length} batch</b>
                  <span className="block text-sm text-muted">{calc.sizes.map((s) => num(s)).join(" + ")} pcs · resep versi {p.version}</span>
                </p>
              </div>
              <ul className="flex flex-col divide-y divide-line">
                {calc.rows.map(({ m, need, short }) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <Thumb src={m.image} alt={m.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{m.name}</span>
                      {short > 0 ? (
                        <span className="text-sm font-semibold text-bad">Kurang {weight(short)}</span>
                      ) : (
                        <span className="text-sm text-muted">{m.tracked ? `Stok cukup` : "Tidak dicek stok"}</span>
                      )}
                    </span>
                    <span className="font-bold tnum">{weight(need)}</span>
                  </li>
                ))}
              </ul>
              {calc.shorts > 0 ? (
                <p className="flex gap-2 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>
                    <b>{calc.shorts} bahan stoknya kurang.</b> Rencana tetap bisa dibuat. Bahan ini akan masuk daftar &ldquo;perlu dibeli&rdquo; di gudang.
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-good">
                  <CheckCircle2 className="size-5" /> Semua stok bahan cukup
                </p>
              )}
            </>
          )}
          <button type="button" disabled={!calc || pending} onClick={submit} className={btn("primary", "xl")}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : null}
            {calc ? `Buat rencana · ${calc.sizes.length} batch` : "Buat rencana"}
          </button>
          {calc && <Pill tone="info" className="self-center">Permintaan bahan otomatis dikirim ke gudang</Pill>}
        </Card>
      </aside>

      <NumberPadModal open={pad} onClose={() => setPad(false)} title="Jumlah produksi (pcs)" initial={qty} unit="pcs" decimal={false} onSubmit={(n) => setQty(Math.max(0, Math.floor(n)))} />
    </div>
  );
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-bold">
      <span className={cx("flex size-9 items-center justify-center rounded-full text-base font-extrabold", done ? "bg-good text-white" : "bg-sunken text-ink-2 border border-line")}>{done ? <CheckCircle2 className="size-5" /> : n}</span>
      {children}
    </h2>
  );
}
