import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, Package } from "lucide-react";
import type { BatchStatus } from "@/db/schema";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "good";
type Size = "sm" | "md" | "lg" | "xl";

export function btn(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  const v: Record<Variant, string> = {
    primary: "bg-brand text-white hover:bg-brand-hover shadow-sm",
    secondary: "bg-surface text-ink border border-line-strong hover:border-ink-2 hover:bg-sunken",
    ghost: "text-ink-2 hover:bg-sunken",
    danger: "bg-surface text-bad border border-bad-line hover:bg-bad-soft",
    good: "bg-good text-white hover:brightness-95 shadow-sm",
  };
  const s: Record<Size, string> = {
    sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
    md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
    lg: "h-14 px-6 text-base gap-2.5 rounded-xl",
    xl: "h-16 px-6 text-lg gap-3 rounded-2xl w-full",
  };
  return cx(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors select-none",
    "disabled:opacity-40 disabled:pointer-events-none",
    v[variant],
    s[size],
    extra,
  );
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cx("bg-surface border border-line rounded-2xl shadow-card", className)}>{children}</As>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <ChevronLeft className="size-4" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "brand" | "good" | "warn" | "bad" | "info";
export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-sunken text-ink-2 border-line",
    brand: "bg-brand-soft text-brand border-brand-line",
    good: "bg-good-soft text-good border-good-line",
    warn: "bg-warn-soft text-warn border-warn-line",
    bad: "bg-bad-soft text-bad border-bad-line",
    info: "bg-info-soft text-info border-info-line",
  };
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export const STATUS: Record<BatchStatus, { label: string; tone: Tone; hint: string }> = {
  menunggu: { label: "Menunggu ditimbang", tone: "neutral", hint: "Bahan belum ditimbang" },
  ditimbang: { label: "Sedang ditimbang", tone: "info", hint: "Sebagian bahan sudah ditimbang" },
  produksi: { label: "Sedang diproduksi", tone: "brand", hint: "Semua bahan siap, menunggu hasil" },
  output: { label: "Menunggu serah terima", tone: "warn", hint: "Hasil sudah dicatat" },
  diterima: { label: "Diterima gudang", tone: "good", hint: "Siap ditutup supervisor" },
  ditutup: { label: "Selesai", tone: "neutral", hint: "Batch ditutup" },
};

export function StatusPill({ status }: { status: BatchStatus }) {
  const s = STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Thumb({ src, alt, size = 56, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  return (
    <span className={cx("relative inline-block shrink-0 overflow-hidden rounded-xl border border-line bg-white", className)} style={{ width: size, height: size }}>
      {src ? <Image src={src} alt={alt} fill sizes={`${size * 2}px`} className="object-contain p-[6%]" /> : <Package className="absolute inset-0 m-auto size-1/2 text-line-strong" aria-hidden="true" />}
    </span>
  );
}

export function Progress({ value, max, tone = "good", className }: { value: number; max: number; tone?: "good" | "brand" | "info"; className?: string }) {
  const p = max ? Math.min(100, (value / max) * 100) : 0;
  const c = { good: "bg-good", brand: "bg-brand", info: "bg-info" }[tone];
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-sunken border border-line", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={cx("h-full rounded-full transition-[width] duration-300", c)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon && <div className="text-muted [&_svg]:size-10">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="max-w-md text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "brand" }) {
  const c = tone ? { good: "text-good", bad: "text-bad", brand: "text-brand" }[tone] : "text-ink";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={cx("text-3xl font-extrabold tracking-tight tnum", c)}>{value}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {aside}
    </div>
  );
}
