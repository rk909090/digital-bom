"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { num } from "@/lib/format";
import { Modal } from "@/components/controls";
import { Pill, btn } from "@/components/ui";

export type CameraResult = { good_total: number; reject_visible: number; full_trays: number; loose: number; confidence: "tinggi" | "sedang" | "rendah"; notes: string };

const MAX_SIDE = 1280;

/** Perkecil foto di perangkat agar cepat dikirim (maks 1280 px, JPEG). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Foto gagal diproses"))), "image/jpeg", 0.82));
}

const CONF = { tinggi: "good", sedang: "warn", rendah: "bad" } as const;

export function CameraCount({ batchCode, product, traySize, aiReady, onApply }: { batchCode: string; product: string; traySize: number; aiReady: boolean; onApply: (r: CameraResult) => void }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; blob: Blob }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<CameraResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setResult(null);
    setErr("");
  };

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setErr("");
    const room = 4 - photos.length;
    const next: { url: string; blob: Blob }[] = [];
    for (const f of Array.from(list).slice(0, room)) {
      try {
        const blob = await shrink(f);
        next.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        setErr("Ada foto yang tidak bisa dibaca. Coba ambil ulang.");
      }
    }
    setPhotos((p) => [...p, ...next]);
    setResult(null);
  }

  async function count() {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("batch", batchCode);
      photos.forEach((p, i) => fd.append("foto", p.blob, `tray-${i + 1}.jpg`));
      const res = await fetch("/api/kamera/hitung", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Penghitungan gagal.");
      setResult(j as CameraResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Penghitungan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong p-4">
        <span className="flex items-center gap-2 text-ink-2">
          <Camera className="size-5" />
          {aiReady ? "Foto tray, AI menghitung produknya" : "Hitung pakai kamera butuh kunci AI di server"}
        </span>
        <button type="button" disabled={!aiReady} onClick={() => setOpen(true)} className={btn("secondary", "md")}>
          <Sparkles className="size-5" /> Hitung pakai kamera
        </button>
      </div>

      <Modal
        wide
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={`Hitung ${product} dengan kamera`}
        footer={
          result ? (
            <>
              <button type="button" className={btn("secondary", "lg")} onClick={reset}>
                <RotateCcw className="size-5" /> Foto ulang
              </button>
              <button
                type="button"
                className={btn("primary", "lg")}
                onClick={() => {
                  onApply(result);
                  setOpen(false);
                  reset();
                }}
              >
                Pakai angka ini
              </button>
            </>
          ) : (
            <button type="button" disabled={!photos.length || busy} onClick={count} className={btn("primary", "lg")}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {busy ? "AI sedang menghitung…" : `Hitung (${photos.length} foto)`}
            </button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {!result && (
            <>
              <p className="text-ink-2">Foto tray <b>dari atas</b>, semua produk terlihat, cahaya cukup. Boleh sampai 4 foto (tray berbeda). Foto tidak disimpan.</p>
              <input ref={input} id="cam-input" type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-sunken">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Foto tray ${i + 1}`} className="size-full object-cover" />
                    <button type="button" aria-label={`Hapus foto ${i + 1}`} disabled={busy} onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-ink/70 text-white">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <label htmlFor="cam-input" className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong text-muted hover:border-brand hover:text-brand">
                    <ImagePlus className="size-8" />
                    <span className="text-sm font-semibold">{photos.length ? "Tambah foto" : "Ambil foto"}</span>
                  </label>
                )}
              </div>
              {busy && <p className="text-sm text-muted">Biasanya 10–40 detik. Jangan tutup layar ini.</p>}
            </>
          )}
          {err && <p className="rounded-xl border border-bad-line bg-bad-soft p-3 font-medium text-bad" role="alert">{err}</p>}
          {result && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={CONF[result.confidence]}>Keyakinan {result.confidence}</Pill>
                <span className="text-sm text-muted">Hasil AI adalah usulan. Periksa sebelum menyimpan.</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-good-soft p-4">
                  <p className="text-sm font-semibold text-good">Produk bagus terhitung</p>
                  <p className="text-4xl font-extrabold text-good tnum">{num(result.good_total)}</p>
                  <p className="text-sm text-ink-2 tnum">= {result.full_trays} tray × {traySize} + {result.loose} satuan</p>
                </div>
                <div className="rounded-xl bg-bad-soft p-4">
                  <p className="text-sm font-semibold text-bad">Tampak reject</p>
                  <p className="text-4xl font-extrabold text-bad tnum">{num(result.reject_visible)}</p>
                  <p className="text-sm text-ink-2">Pilih penyebabnya setelah ini</p>
                </div>
              </div>
              {result.notes && <p className="rounded-xl bg-sunken p-3 text-[15px]">{result.notes}</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
