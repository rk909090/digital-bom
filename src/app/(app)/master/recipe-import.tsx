"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { applyRecipeImportAction, previewRecipeImport } from "@/app/actions/master";
import { Modal } from "@/components/controls";
import { Pill, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type Plan = {
  products: { code: string; name: string; action: "baru" | "versi_baru" | "ubah_nama" | "sama"; version: number | null; lines: number; baseQty: number; traySize: number; changes: string[] }[];
  newMaterials: { code: string; name: string }[];
};

const ACTION: Record<Plan["products"][number]["action"], { label: string; tone: "good" | "info" | "neutral" | "warn" }> = {
  baru: { label: "Produk baru", tone: "good" },
  versi_baru: { label: "Versi resep baru", tone: "info" },
  ubah_nama: { label: "Ganti nama", tone: "warn" },
  sama: { label: "Tidak berubah", tone: "neutral" },
};

/** Impor resep per SKU dari Excel: unduh template → isi → unggah → pratinjau → simpan. */
export function RecipeImportButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const reset = () => {
    setFile(null);
    setErrors([]);
    setPlan(null);
    if (input.current) input.current.value = "";
  };
  const form = (f: File) => {
    const fd = new FormData();
    fd.set("file", f);
    return fd;
  };
  const pick = (f: File | null) => {
    setErrors([]);
    setPlan(null);
    setFile(f);
    if (!f) return;
    if (f.size > 1024 * 1024) return setErrors(["File terlalu besar (maks. 1 MB)."]);
    start(async () => {
      const r = await previewRecipeImport(form(f));
      if (!r.ok) return setErrors([r.error]);
      setErrors(r.data!.errors);
      setPlan(r.data!.plan);
    });
  };
  const apply = () =>
    file &&
    start(async () => {
      const r = await applyRecipeImportAction(form(file));
      if (!r.ok) return toast(r.error, "bad");
      const d = r.data!;
      toast(`Impor selesai: ${d.versionsCreated} versi resep baru, ${d.productsCreated} produk baru, ${d.materialsCreated} bahan baru${d.renamed ? `, ${d.renamed} ganti nama` : ""}.`);
      setOpen(false);
      reset();
      router.refresh();
    });

  const changed = plan?.products.filter((p) => p.action !== "sama").length ?? 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "md")}>
        <FileSpreadsheet className="size-5" /> Impor Excel
      </button>
      <Modal
        open={open}
        wide
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Impor resep dari Excel"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => { setOpen(false); reset(); }}>
              Batal
            </button>
            <button type="button" className={btn("primary", "lg")} disabled={pending || !plan || !changed} onClick={apply}>
              {pending && plan ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} Simpan {changed ? `${changed} produk` : ""}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-2 text-[15px] text-ink-2">
            <li className="flex flex-wrap items-center gap-2">
              <b className="text-ink">1.</b> Unduh template (sudah berisi resep saat ini).
              <a href="/master/template-resep" className={btn("ghost", "sm")}>
                <Download className="size-4" /> Unduh template
              </a>
            </li>
            <li>
              <b className="text-ink">2.</b> Ubah atau tambah baris di sheet <b>Resep</b>, simpan sebagai .xlsx.
            </li>
            <li>
              <b className="text-ink">3.</b> Unggah, periksa pratinjau, lalu simpan.
            </li>
          </ol>

          <label className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors", file ? "border-brand-line bg-brand-soft" : "border-line-strong hover:border-ink-2")}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">
              {pending && !plan ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{file ? file.name : "Pilih file .xlsx"}</span>
              <span className="block text-sm text-muted">{file ? `${Math.ceil(file.size / 1024)} KB · ketuk untuk ganti file` : "Maksimal 1 MB"}</span>
            </span>
            <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>

          {errors.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-bad-line bg-bad-soft p-3 text-bad">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-5" /> Perbaiki dulu {errors.length} masalah berikut, lalu unggah lagi:
              </p>
              <ul className="ml-7 list-disc text-sm">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {plan && (
            <div className="flex flex-col gap-3">
              <p className="font-semibold">
                Pratinjau: {plan.products.length} produk · {changed} akan diubah
                {plan.newMaterials.length > 0 && ` · ${plan.newMaterials.length} bahan baru`}
              </p>
              <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {plan.products.map((p) => (
                  <li key={p.code} className="flex flex-col gap-1 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{p.code}</span>
                      <span className="font-semibold">{p.name}</span>
                      <Pill tone={ACTION[p.action].tone}>
                        {ACTION[p.action].label}
                        {p.action === "versi_baru" || p.action === "baru" ? ` (v${p.version})` : ""}
                      </Pill>
                      <span className="ml-auto text-sm text-muted tnum">
                        {p.lines} bahan · {p.baseQty} pcs/batch
                      </span>
                    </div>
                    {p.action !== "sama" && p.action !== "baru" && <p className="text-sm text-muted">{p.changes.slice(0, 6).join(" · ")}{p.changes.length > 6 ? ` · +${p.changes.length - 6} lagi` : ""}</p>}
                  </li>
                ))}
              </ul>
              {plan.newMaterials.length > 0 && (
                <p className="text-sm text-muted">
                  Bahan baru (stok awal 0): {plan.newMaterials.map((m) => `${m.name} (${m.code})`).join(", ")}
                </p>
              )}
              {!changed && <p className="text-sm font-medium text-muted">Isi file sama dengan resep saat ini. Tidak ada yang perlu disimpan.</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
