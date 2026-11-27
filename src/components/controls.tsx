"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Delete, Minus, Plus, X } from "lucide-react";
import { cx } from "./ui";

/** Keypad angka besar untuk layar sentuh. */
export function Keypad({ value, onChange, decimal = true, maxLength = 8, compact = false }: { value: string; onChange: (v: string) => void; decimal?: boolean; maxLength?: number; compact?: boolean }) {
  const press = (k: string) => {
    if (k === "del") return onChange(value.slice(0, -1));
    if (k === ",") {
      if (!decimal || value.includes(",")) return;
      return onChange((value || "0") + ",");
    }
    if (value.length >= maxLength) return;
    onChange(value === "0" ? k : value + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", decimal ? "," : "", "0", "del"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={`blank-${i}`} />
        ) : (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "del" ? "Hapus angka terakhir" : k === "," ? "Koma" : k}
            className={cx("flex items-center justify-center rounded-xl border border-line-strong bg-surface text-2xl font-bold tnum active:bg-sunken", compact ? "h-14" : "h-16")}
          >
            {k === "del" ? <Delete className="size-6" /> : k}
          </button>
        ),
      )}
    </div>
  );
}

export function parseNum(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Tombol − angka + yang besar. Angka bisa diketuk untuk diketik. */
export function Stepper({ value, onChange, step = 1, min = 0, label, onTapValue, size = "lg" }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label: string; onTapValue?: () => void; size?: "md" | "lg" }) {
  const b = size === "lg" ? "size-14" : "size-11";
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Kurangi ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} className={cx(b, "flex items-center justify-center rounded-full border border-line-strong bg-surface active:bg-sunken disabled:opacity-35")}>
        <Minus className="size-6" />
      </button>
      <button type="button" onClick={onTapValue} aria-label={`${label}: ${value}. Ketuk untuk mengetik`} className={cx("min-w-[4.5rem] rounded-xl px-2 text-center font-extrabold tnum", size === "lg" ? "text-[32px] leading-[56px]" : "text-2xl leading-[44px]", onTapValue && "hover:bg-sunken")}>
        {value}
      </button>
      <button type="button" aria-label={`Tambah ${label}`} onClick={() => onChange(value + step)} className={cx(b, "flex items-center justify-center rounded-full bg-ink text-white active:opacity-80")}>
        <Plus className="size-6" />
      </button>
    </div>
  );
}

/** Dialog modal berbasis <dialog> (aksesibel, Esc menutup). */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx("anim-pop m-auto w-[calc(100%-32px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop", wide ? "max-w-2xl" : "max-w-md")}
    >
      {open && (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="-m-2 rounded-lg p-2 text-muted hover:bg-sunken">
              <X className="size-5" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Modal keypad untuk mengetik angka. */
export function NumberPadModal({ open, onClose, title, initial, unit, decimal, onSubmit }: { open: boolean; onClose: () => void; title: string; initial: number; unit?: string; decimal?: boolean; onSubmit: (n: number) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && <NumberPadBody initial={initial} unit={unit} decimal={decimal} onSubmit={onSubmit} onClose={onClose} />}
    </Modal>
  );
}

function NumberPadBody({ initial, unit, decimal, onSubmit, onClose }: { initial: number; unit?: string; decimal?: boolean; onSubmit: (n: number) => void; onClose: () => void }) {
  const [v, setV] = useState(initial ? String(initial).replace(".", ",") : "");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-end gap-2 rounded-xl border border-line bg-sunken px-4 py-3">
        <span className="text-4xl font-extrabold tnum">{v || "0"}</span>
        {unit && <span className="text-lg text-muted">{unit}</span>}
      </div>
      <Keypad value={v} decimal={decimal} onChange={setV} />
      <button
        type="button"
        className="h-14 rounded-xl bg-brand text-lg font-bold text-white"
        onClick={() => {
          onSubmit(parseNum(v));
          onClose();
        }}
      >
        Pakai angka ini
      </button>
    </div>
  );
}
