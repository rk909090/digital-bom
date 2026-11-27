"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { saveMaterial } from "@/app/actions/master";
import { weight } from "@/lib/format";
import { Modal } from "@/components/controls";
import { Card, Pill, Thumb, btn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Field } from "../master-actions";

type M = { id: number; code: string; name: string; image: string | null; stock: number; minStock: number; tracked: boolean };

export function MaterialsTable({ materials }: { materials: M[] }) {
  const [edit, setEdit] = useState<M | "new" | null>(null);
  return (
    <>
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("new")} className={btn("primary", "md")}>
          <Plus className="size-5" /> Bahan baru
        </button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Bahan</th>
              <th className="px-3 py-3 font-semibold">Kode</th>
              <th className="px-3 py-3 text-right font-semibold">Stok</th>
              <th className="px-3 py-3 text-right font-semibold">Stok minimum</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <Thumb src={m.image} alt="" size={44} />
                    <span className="font-semibold">{m.name}</span>
                  </span>
                </td>
                <td className="px-3 font-mono">{m.code}</td>
                <td className="px-3 text-right font-semibold tnum">{m.tracked ? weight(m.stock) : "–"}</td>
                <td className="px-3 text-right tnum">{m.tracked ? weight(m.minStock) : "–"}</td>
                <td className="px-3">{!m.tracked ? <Pill>Stok tidak dicek</Pill> : m.stock < m.minStock ? <Pill tone="bad">Menipis</Pill> : <Pill tone="good">Aman</Pill>}</td>
                <td className="px-4 text-right">
                  <button type="button" onClick={() => setEdit(m)} className={btn("ghost", "sm")}>
                    <Pencil className="size-4" /> Ubah
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {edit && <MaterialModal key={edit === "new" ? "new" : edit.id} m={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function MaterialModal({ m, onClose }: { m: M | null; onClose: () => void }) {
  const [name, setName] = useState(m?.name ?? "");
  const [code, setCode] = useState(m?.code ?? "");
  const [min, setMin] = useState(m ? String(m.minStock).replace(".", ",") : "0");
  const [tracked, setTracked] = useState(m?.tracked ?? true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={m ? `Ubah ${m.name}` : "Tambah bahan baru"}
      footer={
        <>
          <button type="button" className={btn("secondary", "lg")} onClick={onClose}>Batal</button>
          <button
            type="button"
            className={btn("primary", "lg")}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveMaterial({ id: m?.id, code, name, minStock: parseFloat(min.replace(",", ".")) || 0, tracked });
                if (!r.ok) return toast(r.error, "bad");
                toast(`${name} tersimpan.`);
                onClose();
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="size-5 animate-spin" />} Simpan
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama bahan">
          <input id="mat-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border border-line-strong px-3 text-base" />
        </Field>
        {!m && (
          <Field label="Kode (2–5 huruf)" hint="mis. MTG untuk Margarin">
            <input id="mat-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))} className="h-12 rounded-xl border border-line-strong px-3 font-mono text-base" />
          </Field>
        )}
        <Field label="Stok minimum (kg)" hint="Gudang diberi tanda jika stok di bawah angka ini.">
          <input id="mat-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d,.]/g, ""))} className="h-12 w-40 rounded-xl border border-line-strong px-3 text-base tnum" />
        </Field>
        <label className="flex items-center gap-3">
          <input id="mat-tracked" type="checkbox" checked={tracked} onChange={(e) => setTracked(e.target.checked)} className="size-6 accent-[var(--color-brand)]" />
          <span>
            <span className="block font-semibold">Cek stok bahan ini</span>
            <span className="text-sm text-muted">Matikan untuk bahan seperti air yang tidak disimpan di gudang.</span>
          </span>
        </label>
        {!m && <p className="text-sm text-muted">Bahan baru belum punya gambar. Gambar bisa ditambahkan oleh admin.</p>}
      </div>
    </Modal>
  );
}
