import Link from "next/link";
import type { Metadata } from "next";
import { Download, BarChart3, FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { buildReport, PERIODS, type Period } from "@/lib/report";
import { yieldPct, rejectRate, variance } from "@/lib/rules";
import { dateLong, dateShort, num, pct, pctSigned, weight } from "@/lib/format";
import { Card, Empty, PageHeader, SectionTitle, StatusPill, Thumb, btn, cx } from "@/components/ui";
import type { BatchStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { todayISO } from "@/lib/format";
import { getSettings, num as sNum } from "@/lib/settings";
import { aiEnabled } from "@/lib/ai";
import { DailyReportCard } from "./daily-report";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("laporan");
  const sp = await searchParams;
  const p: Period = sp.p && sp.p in PERIODS ? (sp.p as Period) : "7";
  const [r, daily, settings] = await Promise.all([buildReport(p), db.query.dailyReports.findFirst({ where: eq(t.dailyReports.date, todayISO()) }), getSettings()]);
  const yieldMin = sNum(settings["rule.achievementMinPct"], 95) / 100;
  const yld = yieldPct(r.totGood, r.totTarget);
  const rejPct = rejectRate(r.totGood, r.totReject);
  const prodRate = r.totManHours > 0 ? r.goodWithLabor / r.totManHours : null;
  const perMh = (good: number, mh: number) => (mh > 0 ? num(good / mh, 1) : "–");
  const maxDay = Math.max(1, ...r.byDay.map((d) => Math.max(d.target, d.good)));
  const maxWaste = Math.max(1, ...r.waste.map((w) => w.qty));

  return (
    <>
      <PageHeader
        title="Laporan Produksi"
        subtitle={r.from === r.to ? dateLong(r.to) : `${dateShort(r.from)} – ${dateLong(r.to)}`}
        actions={
          <>
            <div className="flex rounded-xl border border-line-strong bg-surface p-1" role="group" aria-label="Periode">
              {(Object.keys(PERIODS) as Period[]).map((k) => (
                <Link key={k} href={`/laporan?p=${k}`} aria-current={k === p ? "page" : undefined} className={cx("flex h-[34px] items-center rounded-lg px-3.5 text-[15px] font-semibold", k === p ? "bg-ink text-white" : "text-muted hover:text-ink")}>
                  {PERIODS[k].label}
                </Link>
              ))}
            </div>
            <a href={`/laporan/excel?p=${p}`} className={btn("primary", "md")}>
              <FileSpreadsheet className="size-5" /> Unduh Excel
            </a>
            <a href={`/laporan/csv?p=${p}`} className={btn("secondary", "md")}>
              <Download className="size-5" /> CSV
            </a>
          </>
        }
      />

      <DailyReportCard report={daily ? { summary: daily.summary, source: daily.source, createdAt: daily.createdAt } : null} aiReady={aiEnabled()} hour={settings["report.hour"]} />

      {r.planned === 0 ? (
        <Empty title="Belum ada produksi di periode ini" icon={<BarChart3 />}>Pilih periode lain.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Produk bagus" value={num(r.totGood)} sub={`${r.finished} dari ${r.planned} batch sudah dicatat`} tone="good" />
            <Kpi label="Yield" value={r.finished ? pct(yld) : "–"} sub={`bagus ÷ standar output BOM ${num(r.totTarget)} pcs`} tone={yld >= yieldMin - 1e-9 ? "good" : "warn"} />
            <Kpi label="Reject" value={num(r.totReject)} sub={r.totGood + r.totReject ? `${pct(rejPct)} dari total dibuat` : "–"} tone="bad" />
            <Kpi label="Produktivitas" value={prodRate != null ? num(prodRate, 1) : "–"} sub={prodRate != null ? `pcs per orang-jam (${num(r.totManHours, 1)} orang-jam)` : "jam kerja belum dicatat"} tone="good" />
            <Kpi label="Penyimpangan terbuka" value={num(r.exOpen)} sub={r.exOpen ? "perlu diperiksa supervisor" : "semua sudah diperiksa"} tone={r.exOpen ? "bad" : "good"} className="max-md:col-span-2" />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SectionTitle>{p === "hari" ? "Hasil per batch" : "Hasil per hari"}</SectionTitle>
              <Card className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap gap-4 text-sm text-muted">
                  <span className="flex items-center gap-2"><i className="inline-block h-3 w-4 rounded-sm bg-good" /> Bagus</span>
                  <span className="flex items-center gap-2"><i className="inline-block h-4 w-[3px] rounded bg-ink" /> Standar output BOM</span>
                </div>
                {(p === "hari" ? r.batches.filter((b) => b.good != null).map((b) => ({ key: b.code, label: b.code, sub: b.product, target: b.target, good: b.good! })) : r.byDay.map((d) => ({ key: d.date, label: dateShort(d.date), sub: "", target: d.target, good: d.good }))).map((row) => {
                  const max = p === "hari" ? Math.max(1, ...r.batches.map((b) => Math.max(b.target, b.good ?? 0))) : maxDay;
                  return (
                    <div key={row.key} className="grid grid-cols-[110px_minmax(0,1fr)_92px] items-center gap-3">
                      <span className="leading-tight">
                        <span className="block font-semibold tnum">{row.label}</span>
                        {row.sub && <span className="block truncate text-xs text-muted">{row.sub}</span>}
                      </span>
                      <span className="relative h-5 rounded-md bg-sunken">
                        <span className="absolute inset-y-0 left-0 rounded-md bg-good" style={{ width: `${(row.good / max) * 100}%` }} />
                        <span className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded bg-ink" style={{ left: `${(row.target / max) * 100}%` }} />
                      </span>
                      <span className="text-right text-sm tnum">
                        <b>{num(row.good)}</b>
                        <span className="block text-xs text-muted">{pct(row.good / row.target, 0)}</span>
                      </span>
                    </div>
                  );
                })}
                {r.finished === 0 && <p className="text-muted">Belum ada hasil produksi yang dicatat.</p>}
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle>Reject menurut penyebab</SectionTitle>
              <Card className="flex flex-col gap-3 p-5">
                {r.waste.length === 0 ? (
                  <p className="text-muted">Tidak ada reject.</p>
                ) : (
                  r.waste.map((w) => (
                    <div key={w.label} className="grid grid-cols-[150px_minmax(0,1fr)_70px] items-center gap-3">
                      <span className="font-semibold">{w.label}</span>
                      <span className="h-5 rounded-md bg-sunken">
                        <span className="block h-full rounded-md bg-bad/80" style={{ width: `${(w.qty / maxWaste) * 100}%` }} />
                      </span>
                      <span className="text-right text-sm tnum">
                        <b>{w.qty}</b> <span className="text-muted">({pct(w.qty / r.totReject, 0)})</span>
                      </span>
                    </div>
                  ))
                )}
              </Card>
              <SectionTitle>Pengiriman produk jadi per tujuan</SectionTitle>
              <Card className="flex flex-col divide-y divide-line px-5">
                {r.byDestination.length === 0 ? (
                  <p className="py-4 text-muted">Belum ada pengiriman.</p>
                ) : (
                  r.byDestination.map((d) => (
                    <div key={d.destination} className="flex items-center justify-between gap-3 py-3">
                      <span className="font-semibold">{d.destination}</span>
                      <span className="text-sm text-muted tnum">
                        <b className="text-base text-ink">{num(d.qty)} pcs</b> · {d.shipments} kiriman
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <SectionTitle>Per produk</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[15px]">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-3 py-3 text-right font-semibold">Batch</th>
                    <th className="px-3 py-3 text-right font-semibold">Standar output</th>
                    <th className="px-3 py-3 text-right font-semibold">Bagus</th>
                    <th className="px-3 py-3 text-right font-semibold">Yield</th>
                    <th className="px-3 py-3 text-right font-semibold">Reject</th>
                    <th className="px-3 py-3 text-right font-semibold">Orang-jam</th>
                    <th className="px-4 py-3 text-right font-semibold">Pcs/orang-jam</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byProduct.map((x) => (
                    <tr key={x.name} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold">{x.name}</td>
                      <td className="px-3 text-right tnum">{x.batches}</td>
                      <td className="px-3 text-right tnum">{num(x.target)}</td>
                      <td className="px-3 text-right font-semibold text-good tnum">{num(x.good)}</td>
                      <td className={cx("px-3 text-right font-semibold tnum", yieldPct(x.good, x.target) < yieldMin - 1e-9 && "text-warn")}>{pct(yieldPct(x.good, x.target))}</td>
                      <td className="px-3 text-right text-bad tnum">
                        {num(x.reject)} <span className="text-xs text-muted">({pct(rejectRate(x.good, x.reject))})</span>
                      </td>
                      <td className="px-3 text-right tnum">{x.manHours ? num(x.manHours, 1) : "–"}</td>
                      <td className="px-4 text-right font-semibold tnum">{perMh(x.goodWithLabor, x.manHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Pemakaian bahan: resep vs aktual</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[15px]">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-3 font-semibold">Bahan</th>
                    <th className="px-3 py-3 text-right font-semibold">Menurut resep</th>
                    <th className="px-3 py-3 text-right font-semibold">Terpakai</th>
                    <th className="px-3 py-3 text-right font-semibold">Selisih</th>
                    <th className="px-4 py-3 text-right font-semibold">Di luar batas</th>
                  </tr>
                </thead>
                <tbody>
                  {r.materials.map((m) => {
                    const v = variance(m.actual, m.std);
                    return (
                      <tr key={m.name} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-3">
                            <Thumb src={m.image} alt="" size={34} />
                            <span className="font-semibold">{m.name}</span>
                          </span>
                        </td>
                        <td className="px-3 text-right tnum">{weight(m.std)}</td>
                        <td className="px-3 text-right font-semibold tnum">{weight(m.actual)}</td>
                        <td className={cx("px-3 text-right tnum", Math.abs(v) > 0.03 ? "font-bold text-bad" : "text-muted")}>{pctSigned(v)}</td>
                        <td className="px-4 text-right tnum">{m.out ? <span className="font-semibold text-bad">{m.out}×</span> : <span className="text-muted">–</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Semua batch</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[15px]">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-3 py-3 font-semibold">Produk</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Standar</th>
                    <th className="px-3 py-3 text-right font-semibold">Bagus</th>
                    <th className="px-3 py-3 text-right font-semibold">Yield</th>
                    <th className="px-3 py-3 text-right font-semibold">Reject</th>
                    <th className="px-3 py-3 text-right font-semibold">Orang × jam</th>
                    <th className="px-4 py-3 font-semibold">Dikirim ke</th>
                  </tr>
                </thead>
                <tbody>
                  {r.batches.map((b) => (
                    <tr key={b.code} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/batch/${b.code}`} className="font-mono font-semibold text-brand hover:underline">{b.code}</Link>
                      </td>
                      <td className="px-3">{b.product}</td>
                      <td className="px-3"><StatusPill status={b.status as BatchStatus} /></td>
                      <td className="px-3 text-right tnum">{num(b.target)}</td>
                      <td className="px-3 text-right tnum">{b.good != null ? num(b.good) : "–"}</td>
                      <td className="px-3 text-right tnum">{b.good != null ? pct(yieldPct(b.good, b.target)) : "–"}</td>
                      <td className="px-3 text-right tnum">{b.reject != null ? num(b.reject) : "–"}</td>
                      <td className="px-3 text-right tnum">{b.good != null && b.manHours ? `${b.workers} × ${num(b.hours, 1)}` : "–"}</td>
                      <td className="px-4">{b.destination ?? <span className="text-muted">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
          <p className="text-sm text-muted">Yield = produk bagus ÷ standar output BOM. Reject % = reject ÷ (bagus + reject). Produktivitas = produk bagus ÷ (jumlah orang × lama kerja), hanya dari batch yang jam kerjanya dicatat.</p>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone, className }: { label: string; value: string; sub: string; tone: "good" | "bad" | "warn"; className?: string }) {
  const c = { good: "text-good", bad: "text-bad", warn: "text-warn" }[tone];
  return (
    <Card className={cx("flex flex-col gap-1 p-4", className)}>
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={cx("text-3xl font-extrabold tracking-tight tnum", c)}>{value}</span>
      <span className="text-sm text-muted">{sub}</span>
    </Card>
  );
}
