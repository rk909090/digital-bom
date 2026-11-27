import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { getBatch } from "@/lib/queries";
import { REJECT_REASONS } from "@/db/schema";
import { goodQty, isOutOfTolerance, productivity, rejectRate, variance, yieldPct } from "@/lib/rules";
import { dateLong, dateTime, num, pct, pctSigned, weight, weightSigned } from "@/lib/format";
import { Card, PageHeader, Pill, SectionTitle, StatusPill, Thumb, btn, cx } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Batch ${(await params).code}` };
}

export default async function BatchPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser("batch");
  const b = await getBatch(decodeURIComponent((await params).code));
  if (!b) notFound();

  const weighed = b.materials.filter((m) => m.actualQty != null);
  const lastWeigh = weighed.map((m) => m.weighedAt!).sort().at(-1);
  const good = b.output ? goodQty(b.output.trays, b.product.traySize, b.output.loose) : null;
  const reject = b.rejects.reduce((a, r) => a + r.qty, 0);
  const openEx = b.exceptions.filter((e) => e.status !== "disetujui");

  const steps = [
    { label: "Direncanakan", done: true, who: null, at: b.createdAt },
    { label: "Bahan ditimbang", done: weighed.length === b.materials.length, who: `${weighed.length}/${b.materials.length} bahan`, at: weighed.length === b.materials.length ? lastWeigh : null },
    { label: "Masuk freezer", done: !!b.wipInAt, who: b.wipInAt ? `${b.doughKg != null ? weight(b.doughKg) : "-"} · ${b.wipInUser?.name ?? "-"}` : null, at: b.wipInAt },
    { label: "Keluar freezer", done: !!b.wipOutAt, who: b.wipOutUser?.name, at: b.wipOutAt },
    { label: "Hasil dicatat", done: !!b.output, who: b.output?.recorder?.name, at: b.output?.recordedAt },
    { label: "Dikirim", done: !!b.handover, who: b.handover ? `${b.handover.destination} · ${b.handover.receiver?.name ?? "-"}` : null, at: b.handover?.receivedAt },
    { label: "Ditutup", done: b.status === "ditutup", who: b.closer?.name, at: b.closedAt },
  ];

  const action =
    (b.status === "menunggu" || b.status === "ditimbang") && can(user.role, "timbang") ? { href: `/timbang/${b.code}`, label: "Timbang bahan" }
    : (b.status === "adonan" || b.status === "wip") && can(user.role, "wip") ? { href: "/wip", label: b.status === "adonan" ? "Masukkan ke freezer" : "Keluarkan dari freezer" }
    : b.status === "produksi" && can(user.role, "output") ? { href: `/output/${b.code}`, label: "Catat hasil produksi" }
    : b.status === "output" && can(user.role, "pengiriman") ? { href: `/pengiriman/${b.code}`, label: "Kirim produk jadi" }
    : b.status === "diterima" && can(user.role, "verifikasi") ? { href: "/verifikasi", label: openEx.length ? "Periksa penyimpangan" : "Tutup batch" }
    : null;

  const totStd = weighed.reduce((a, m) => a + m.stdQty, 0);
  const totAct = weighed.reduce((a, m) => a + (m.actualQty ?? 0), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Beranda" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Thumb src={b.product.image} alt={b.product.name} size={52} />
            {b.product.name} <StatusPill status={b.status} />
          </span>
        }
        subtitle={
          <>
            Batch <span className="font-mono font-semibold text-ink-2">{b.code}</span> · {dateLong(b.date)} · Standar output {num(b.target)} pcs · Order {b.order.code}
          </>
        }
        actions={action ? <Link href={action.href} className={btn("primary", "lg")}>{action.label}</Link> : undefined}
      />

      {/* linimasa */}
      <Card className="p-5">
        <ol className="grid gap-4 sm:grid-cols-4 xl:grid-cols-7">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-3 sm:flex-col">
              <div className="flex items-center gap-2 sm:w-full">
                <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full font-bold", s.done ? "bg-good text-white" : "border-2 border-line-strong text-muted")}>{s.done ? <Check className="size-5" strokeWidth={3} /> : i + 1}</span>
                {i < steps.length - 1 && <span className={cx("hidden h-1 flex-1 rounded xl:block", s.done ? "bg-good" : "bg-line")} />}
              </div>
              <div className="leading-tight">
                <p className={cx("font-bold", !s.done && "text-muted")}>{s.label}</p>
                <p className="text-sm text-muted">
                  {s.who}
                  {s.at && (s.who ? " · " : "") + dateTime(s.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {openEx.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-bad-line bg-bad-soft p-4 text-bad">
          <AlertTriangle className="size-6 shrink-0" />
          <p className="font-semibold">
            {openEx.length} penyimpangan belum disetujui supervisor. Batch belum bisa ditutup.
          </p>
          {can(user.role, "verifikasi") && <Link href="/verifikasi" className={btn("danger", "sm", "ml-auto")}>Periksa</Link>}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <SectionTitle>Rekonsiliasi bahan (resep vs aktual)</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-sm text-muted">
                  <th className="px-4 py-3 font-semibold">Bahan</th>
                  <th className="px-3 py-3 text-right font-semibold">Standar</th>
                  <th className="px-3 py-3 text-right font-semibold">Aktual</th>
                  <th className="px-3 py-3 text-right font-semibold">Selisih</th>
                  <th className="px-4 py-3 font-semibold">Ditimbang</th>
                </tr>
              </thead>
              <tbody>
                {b.materials.map((m) => {
                  const done = m.actualQty != null;
                  const out = done && isOutOfTolerance(m.actualQty!, m.stdQty, m.tolerancePct);
                  return (
                    <tr key={m.id} className={cx("border-b border-line last:border-0", out && "bg-bad-soft")}>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          <Thumb src={m.material.image} alt="" size={36} />
                          <span className="font-semibold">{m.material.name}</span>
                        </span>
                      </td>
                      <td className="px-3 text-right tnum">{weight(m.stdQty)}</td>
                      <td className="px-3 text-right font-semibold tnum">{done ? weight(m.actualQty!) : <span className="font-normal text-muted">belum</span>}</td>
                      <td className={cx("px-3 text-right tnum", out ? "font-bold text-bad" : "text-muted")}>
                        {done ? `${weightSigned(m.actualQty! - m.stdQty)} (${pctSigned(variance(m.actualQty!, m.stdQty))})` : "–"}
                      </td>
                      <td className="px-4 text-sm text-muted">{done ? `${m.weigher?.name ?? "-"} · ${m.source}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {weighed.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-line font-bold">
                    <td className="px-4 py-3">Total ditimbang</td>
                    <td className="px-3 text-right tnum">{weight(totStd)}</td>
                    <td className="px-3 text-right tnum">{weight(totAct)}</td>
                    <td className="px-3 text-right tnum">{pctSigned(variance(totAct, totStd))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Hasil produksi</SectionTitle>
          {b.output && good != null ? (
            <Card className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted">Bagus</p>
                  <p className="text-3xl font-extrabold text-good tnum">{num(good)}</p>
                  <p className="text-sm text-muted tnum">{b.output.trays} tray × {b.product.traySize} + {b.output.loose}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Reject</p>
                  <p className="text-3xl font-extrabold text-bad tnum">{num(reject)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Yield (vs standar BOM)</p>
                  <p className="text-2xl font-bold tnum">{pct(yieldPct(good, b.target))}</p>
                  <p className="text-sm text-muted tnum">{num(good)} ÷ {num(b.target)} pcs</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Reject</p>
                  <p className="text-2xl font-bold tnum">{pct(rejectRate(good, reject))}</p>
                  <p className="text-sm text-muted">dari total dibuat</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Jam kerja</p>
                  <p className="text-2xl font-bold tnum">{b.output.workers ? `${b.output.workers} × ${num(b.output.hours, 1)} jam` : "–"}</p>
                  {b.output.workers > 0 && <p className="text-sm text-muted tnum">{num(b.output.workers * b.output.hours, 1)} orang-jam</p>}
                </div>
                <div>
                  <p className="text-sm text-muted">Produktivitas</p>
                  <p className="text-2xl font-bold tnum">{productivity(good, b.output.workers, b.output.hours) != null ? num(productivity(good, b.output.workers, b.output.hours)!, 1) : "–"}</p>
                  <p className="text-sm text-muted">pcs per orang-jam</p>
                </div>
              </div>
              {b.rejects.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {b.rejects.map((r) => (
                    <li key={r.id}>
                      <Pill tone="bad">{REJECT_REASONS.find((x) => x.key === r.reason)?.label ?? r.reason}: {r.qty}</Pill>
                    </li>
                  ))}
                </ul>
              )}
              {b.handover && (
                <p className="flex items-center gap-2 border-t border-line pt-3 text-[15px]">
                  <CheckCircle2 className="size-5 text-good" />
                  <span>
                    Dikirim ke <b>{b.handover.destination}</b>: <b className="tnum">{num(b.handover.qtySent)} pcs</b> <span className="text-muted">({b.handover.code})</span>
                  </span>
                </p>
              )}
            </Card>
          ) : (
            <Card className="p-5 text-muted">Hasil produksi belum dicatat.</Card>
          )}

          {b.exceptions.length > 0 && (
            <>
              <SectionTitle>Penyimpangan</SectionTitle>
              <Card className="divide-y divide-line">
                {b.exceptions.map((e) => (
                  <div key={e.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{e.code}</span>
                      <span className="font-semibold">{e.type === "bahan" ? `Selisih ${e.material?.name}` : "Selisih serah terima"}</span>
                      {e.status === "disetujui" ? <Pill tone="good">Disetujui</Pill> : e.status === "investigasi" ? <Pill tone="warn">Investigasi</Pill> : <Pill tone="bad">Terbuka</Pill>}
                    </div>
                    <p className="text-sm text-muted">
                      {e.type === "bahan" ? `${weight(e.expected)} → ${weight(e.actual)} (${pctSigned(variance(e.actual, e.expected))})` : `${e.expected} → ${e.actual} pcs`} · {e.reason} · {e.creator?.name}
                      {e.resolutionNote && ` · Supervisor: ${e.resolutionNote}`}
                    </p>
                  </div>
                ))}
              </Card>
            </>
          )}
        </section>
      </div>
    </>
  );
}
