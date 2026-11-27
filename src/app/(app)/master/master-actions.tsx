"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { createProduct, resetDemo } from "@/app/actions/master";
import { Modal } from "@/components/controls";
import { btn } from "@/components/ui";
import { useToast } from "@/components/toast";

export function NewProductButton() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tray, setTray] = useState("20");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("primary", "md")}>
        <Plus className="size-5" /> Produk baru
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tambah produk baru"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setOpen(false)}>Batal</button>
            <button
              type="button"
              className={btn("primary", "lg")}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createProduct({ code, name, traySize: Number(tray) });
                  if (!r.ok) return toast(r.error, "bad");
                  toast(`${name} dibuat. Sekarang isi resepnya.`);
                  router.push(`/master/resep/${r.data!.code}`);
                })
              }
            >
              {pending && <Loader2 className="size-5 animate-spin" />} Buat & isi resep
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nama produk" hint="mis. Roti Keju">
            <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border border-line-strong px-3 text-base" />
          </Field>
          <Field label="Kode singkat (2–5 huruf)" hint="Dipakai di nomor batch, mis. RKJ-261127-01">
            <input id="np-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))} className="h-12 rounded-xl border border-line-strong px-3 font-mono text-base uppercase" />
          </Field>
          <Field label="Isi per tray (pcs)">
            <input id="np-tray" inputMode="numeric" value={tray} onChange={(e) => setTray(e.target.value.replace(/\D/g, ""))} className="h-12 w-32 rounded-xl border border-line-strong px-3 text-base" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("danger", "md")}>
        <RotateCcw className="size-5" /> Reset demo
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset semua data ke contoh awal?"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setOpen(false)}>Batal</button>
            <button
              type="button"
              className={btn("primary", "lg")}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await resetDemo();
                  if (!r.ok) return toast(r.error, "bad");
                  setOpen(false);
                  toast("Data demo sudah dikembalikan. Silakan masuk lagi.");
                  router.push("/masuk");
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-5 animate-spin" />} Ya, reset
            </button>
          </>
        }
      >
        <p>Semua rencana, timbangan, hasil produksi, dan perubahan resep akan dihapus lalu diganti data contoh. Gunakan hanya untuk demo atau pelatihan.</p>
      </Modal>
    </>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}
