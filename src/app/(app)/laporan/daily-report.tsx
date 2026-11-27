"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { makeDailyReport } from "@/app/actions/pengaturan";
import { dateTime } from "@/lib/format";
import { Card, Pill, btn } from "@/components/ui";
import { useToast } from "@/components/toast";

export function DailyReportCard({ report, aiReady, hour }: { report: { summary: string; source: "ai" | "template"; createdAt: string } | null; aiReady: boolean; hour: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const make = () =>
    start(async () => {
      const r = await makeDailyReport();
      if (!r.ok) return toast(r.error, "bad");
      toast(r.data!.source === "ai" ? "Ringkasan AI dibuat dan dikirim ke Supervisor & PPIC." : "Laporan dibuat (ringkasan template) dan dikirim ke Supervisor & PPIC.");
      router.refresh();
    });
  return (
    <Card className="flex flex-col gap-3 border-brand-line p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Laporan harian</h2>
          <p className="text-sm text-muted">Dibuat otomatis pukul {hour}.00 WIB dan dikirim ke Supervisor & PPIC.</p>
        </div>
        {report && (report.source === "ai" ? <Pill tone="info"><Sparkles className="size-3.5" /> Ditulis AI (Claude Opus 5.5)</Pill> : <Pill>Ringkasan template</Pill>)}
        <button type="button" disabled={pending} onClick={make} className={btn(report ? "secondary" : "primary", "md")}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
          {report ? "Perbarui" : "Buat sekarang"}
        </button>
      </div>
      {report ? (
        <>
          <p className="max-w-[75ch] whitespace-pre-line text-[16px] leading-relaxed">{report.summary}</p>
          <p className="text-xs text-muted">Dibuat {dateTime(report.createdAt)}. Angka diambil dari data produksi; {report.source === "ai" ? "AI hanya menulis kalimatnya." : "kalimat dari template."}</p>
        </>
      ) : (
        <p className="text-muted">Laporan hari ini belum dibuat.</p>
      )}
      {!aiReady && <p className="text-xs text-muted">Ringkasan AI belum aktif: Admin perlu mengisi kunci AI (OPENROUTER_API_KEY atau ANTHROPIC_API_KEY) di server.</p>}
    </Card>
  );
}
