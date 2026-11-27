import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cx } from "./ui";

export type Task = {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Jumlah pekerjaan yang menunggu. Kosong = kartu pintasan tanpa angka. */
  count?: number;
  /** Satuan angka, mis. "batch", "adonan". */
  unit?: string;
  /** Kalimat setelah angka, mis. "menunggu ditimbang". Untuk kartu tanpa angka: penjelasan singkat. */
  desc: string;
  /** Rincian kecil di bawah kalimat (opsional). */
  detail?: string;
  /** Kalimat saat angka 0. */
  empty?: string;
  /** Merah: perlu perhatian segera. */
  alert?: boolean;
};

const TONE = {
  alert: { card: "border-bad-line bg-bad-soft hover:border-bad", icon: "bg-bad text-white", count: "bg-bad text-white shadow-bad/30" },
  active: { card: "border-brand-line bg-brand-soft hover:border-brand", icon: "bg-brand text-white", count: "bg-brand text-white shadow-brand/30" },
  idle: { card: "border-line bg-surface hover:border-line-strong", icon: "bg-sunken text-muted", count: "" },
  link: { card: "border-line bg-surface hover:border-brand-line", icon: "bg-brand-soft text-brand", count: "" },
} as const;

/**
 * Kartu tugas yang bisa diketuk. Jika ada pekerjaan menunggu, kartu berwarna dan angkanya
 * tampil besar di kotak berwarna penuh supaya langsung terlihat.
 */
export function TaskCard({ t }: { t: Task }) {
  const counted = t.count !== undefined;
  const has = counted && t.count! > 0;
  const tone = !counted ? TONE.link : !has ? TONE.idle : t.alert ? TONE.alert : TONE.active;
  const Icon = t.icon;
  const label = counted ? (has ? `${t.title}: ${t.count} ${t.unit ?? ""} ${t.desc}` : `${t.title}: ${t.empty}`) : `${t.title}: ${t.desc}`;

  return (
    <Link
      href={t.href}
      aria-label={label}
      className={cx(
        "group relative flex min-h-[112px] items-center gap-4 rounded-2xl border p-4 shadow-card transition",
        "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
        tone.card,
      )}
    >
      <span className={cx("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone.icon)}>
        <Icon className="size-7" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{t.title}</span>
        {counted && !has ? (
          <span className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-good">
            <CheckCircle2 className="size-4 shrink-0" /> {t.empty}
          </span>
        ) : (
          <span className={cx("mt-1 block text-[15px] leading-snug", has ? "font-semibold text-ink-2" : "text-muted")}>{t.desc}</span>
        )}
        {has && t.detail && <span className="mt-1 block text-sm text-muted">{t.detail}</span>}
      </span>

      {has ? (
        <span className={cx("flex h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-2xl px-2.5 shadow-lg", tone.count)} aria-hidden="true">
          <span className="text-[34px] font-extrabold leading-none tnum">{t.count! > 999 ? "999+" : t.count}</span>
          {t.unit && <span className="mt-0.5 text-xs font-semibold opacity-90">{t.unit}</span>}
        </span>
      ) : (
        <ArrowRight className={cx("size-6 shrink-0 transition group-hover:translate-x-0.5", counted ? "text-muted" : "text-brand")} />
      )}
    </Link>
  );
}
