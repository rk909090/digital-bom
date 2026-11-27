import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import type { BatchSummary } from "@/lib/queries";
import { Progress, StatusPill, Thumb, cx } from "./ui";
import { num, pct, dateShort } from "@/lib/format";

/** Kartu batch ringkas. `href` menentukan tujuan saat diketuk. */
export function BatchCard({ b, href, cta, showDate }: { b: BatchSummary; href?: string; cta?: string; showDate?: boolean }) {
  const inner = (
    <>
      <Thumb src={b.product.image} alt={b.product.name} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lg font-bold leading-tight">{b.product.name}</span>
          <StatusPill status={b.status} />
          {b.openEx > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-bad">
              <AlertTriangle className="size-4" /> {b.openEx} perlu dicek
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm text-muted">
          <span className="font-mono font-semibold text-ink-2">{b.code}</span> · Target {num(b.target)} pcs{showDate && ` · ${dateShort(b.date)}`}
        </div>
        <div className="mt-2">
          {b.good != null ? (
            <p className="text-sm">
              <b className="text-good tnum">{num(b.good)} pcs bagus</b>
              <span className="text-muted"> · {pct(b.good / b.target)} dari target · reject {num(b.reject ?? 0)}</span>
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Progress value={b.weighed} max={b.totalLines} tone={b.weighed === b.totalLines ? "good" : "info"} className="max-w-56" />
              <span className="text-sm text-muted tnum">
                Bahan {b.weighed}/{b.totalLines}
              </span>
            </div>
          )}
        </div>
      </div>
      {href && (
        <span className="flex shrink-0 items-center gap-1 self-center text-[15px] font-semibold text-brand">
          <span className="hidden sm:inline">{cta}</span>
          <ChevronRight className="size-6" />
        </span>
      )}
    </>
  );
  const cls = "flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card";
  return href ? (
    <Link href={href} className={cx(cls, "transition hover:border-brand hover:shadow-md active:scale-[0.995]")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
