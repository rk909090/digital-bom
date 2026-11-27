"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { saveBom } from "@/app/actions/master";
import { num, weight } from "@/lib/format";
import { Modal } from "@/components/controls";
import { Card, Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type Mat = { id: number; name: string; image: string | null; code: string };
type L = { materialId: number; qty: number; tolerancePct: number };

const toStr = (n: number) => String(n).replace(".", ",");
const toNum = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function BomEditor({ product, initial, materials }: { product: { id: number; name: string; traySize: number }; initial: { baseQty: number; lines: L[] }; materials: Mat[] }) {
  const [base, setBase] = useState(String(initial.baseQty));
  const [tray, setTray] = useState(String(product.traySize));
  const [rows, setRows] = useState(initial.lines.map((l) => ({ materialId: l.materialId, qty: toStr(l.qty), tol: toStr(l.tolerancePct) })));
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const mat = (id: number) => materials.find((m) => m.id === id)!;
  const baseN = Math.floor(toNum(base));
  const used = new Set(rows.map((r) => r.materialId));
  const totalKg = rows.reduce((a, r) => a + toNum(r.qty), 0);

  const dirty = useMemo(
    () => JSON.stringify({ b: baseN, t: tray, r: rows.map((r) => [r.materialId, toNum(r.qty), toNum(r.tol)]) }) !== JSON.stringify({ b: initial.baseQty, t: String(product.traySize), r: initial.lines.map((l) => [l.materialId, l.qty, l.tolerancePct]) }),
    [baseN, tray, rows, initial, product.traySize],
  );

  const update = (i: number, k: "qty" | "tol", v: string) => setRows((x) => x.map((r, j) => (j === i ? { ...r, [k]: v.replace(/[^\d,.]/g, "") } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((x) => {
      const y = [...x];
      const j = i + d;
      if (j < 0 || j >= y.length) return x;
      [y[i], y[j]] = [y[j], y[i]];
      return y;
    });

  const save = () =>
    start(async () => {
      const r = await saveBom({ productId: product.id, baseQty: baseN, traySize: Number(tray), note, lines: rows.map((r) => ({ materialId: r.materialId, qty: toNum(r.qty), tolerancePct: toNum(r.tol) })) });
      if (!r.ok) return toast(r.error, "bad");
      toast(`Resep ${product.name} versi ${r.data!.version} tersimpan.`);
      setConfirm(false);
      setNote("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">1 batch menghasilkan</span>
          <span className="flex items-center gap-2">
            <input id="bom-base" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/\D/g, ""))} className="h-14 w-36 rounded-xl border border-line-strong px-3 text-2xl font-bold tnum" />
            <span className="text-muted">pcs</span>
          </span>
          <span className="text-sm text-muted">Jumlah bahan di bawah adalah untuk sebanyak ini.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">Isi 1 tray</span>
          <span className="flex items-center gap-2">
            <input id="bom-tray" inputMode="numeric" value={tray} onChange={(e) => setTray(e.target.value.replace(/\D/g, ""))} className="h-14 w-28 rounded-xl border border-line-strong px-3 text-2xl font-bold tnum" />
            <span className="text-muted">pcs</span>
          </span>
          <span className="text-sm text-muted">Dipakai di stasiun hasil produksi.</span>
        </label>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Bahan</th>
              <th className="px-3 py-3 font-semibold">Jumlah per batch (kg)</th>
              <th className="px-3 py-3 font-semibold">Per pcs</th>
              <th className="px-3 py-3 font-semibold">Toleransi timbang (±%)</th>
              <th className="px-4 py-3 text-right font-semibold">Atur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const m = mat(r.materialId);
              const q = toNum(r.qty);
              return (
                <tr key={r.materialId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <Thumb src={m.image} alt="" size={40} />
                      <span className="font-semibold">{m.name}</span>
                    </span>
                  </td>
                  <td className="px-3">
                    <input id={`q-${r.materialId}`} inputMode="decimal" value={r.qty} onChange={(e) => update(i, "qty", e.target.value)} aria-label={`Jumlah ${m.name}`} className={cx("h-11 w-32 rounded-xl border px-3 text-right text-lg font-semibold tnum", q > 0 ? "border-line-strong" : "border-bad bg-bad-soft")} />
                    <span className="ml-2 text-sm text-muted">{q > 0 && q < 1 ? `= ${weight(q)}` : ""}</span>
                  </td>
                  <td className="px-3 text-muted tnum">{baseN > 0 && q > 0 ? `${num((q / baseN) * 1000, 1)} g` : "–"}</td>
                  <td className="px-3">
                    <input id={`t-${r.materialId}`} inputMode="decimal" value={r.tol} onChange={(e) => update(i, "tol", e.target.value)} aria-label={`Toleransi ${m.name}`} className="h-11 w-20 rounded-xl border border-line-strong px-3 text-right tnum" />
                  </td>
                  <td className="px-4">
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btn("ghost", "sm")} aria-label={`Naikkan ${m.name}`}><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className={btn("ghost", "sm")} aria-label={`Turunkan ${m.name}`}><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className={btn("ghost", "sm", "text-bad")} aria-label={`Hapus ${m.name}`}><Trash2 className="size-4" /></button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line">
              <td className="px-4 py-3 font-bold">Total adonan</td>
              <td className="px-3 font-bold tnum">{weight(totalKg)}</td>
              <td className="px-3 text-muted tnum">{baseN > 0 ? `${num((totalKg / baseN) * 1000, 1)} g/pcs` : ""}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        <div className="border-t border-line p-4">
          <button type="button" onClick={() => setAdding(true)} className={btn("secondary", "md")}>
            <Plus className="size-5" /> Tambah bahan
          </button>
          <span className="ml-3 text-sm text-muted">Urutan bahan = urutan menimbang di stasiun.</span>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty && <span className="text-sm font-semibold text-warn">Ada perubahan yang belum disimpan</span>}
        <button type="button" disabled={!dirty || !rows.length} onClick={() => setConfirm(true)} className={btn("primary", "lg")}>
          <Save className="size-5" /> Simpan sebagai versi baru
        </button>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Pilih bahan" wide>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {materials.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={used.has(m.id)}
              onClick={() => {
                setRows((x) => [...x, { materialId: m.id, qty: "", tol: m.code === "RGI" || m.code === "GRM" ? "3" : "5" }]);
                setAdding(false);
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-line p-3 hover:border-brand disabled:opacity-35"
            >
              <Thumb src={m.image} alt="" size={64} />
              <span className="text-center font-semibold leading-tight">{m.name}</span>
              {used.has(m.id) && <span className="text-xs text-muted">sudah di resep</span>}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Simpan resep sebagai versi baru?"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setConfirm(false)}>Batal</button>
            <button type="button" className={btn("primary", "lg")} disabled={pending} onClick={save}>
              {pending && <Loader2 className="size-5 animate-spin" />} Simpan
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>Rencana produksi berikutnya akan memakai resep ini. Batch yang sudah dibuat tidak berubah.</p>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Alasan perubahan</span>
            <input id="bom-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Penyesuaian butter dari R&D" className="h-12 rounded-xl border border-line-strong px-3 text-base" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
