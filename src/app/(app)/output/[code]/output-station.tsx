"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, Clock, LayoutGrid, Loader2, Shapes, Sparkles, Users, XCircle } from "lucide-react";
import { CameraCount } from "./camera-count";
import { saveOutput } from "@/app/actions/produksi";
import { goodQty, productivity, rejectRate, yieldPct } from "@/lib/rules";
import { num, pct } from "@/lib/format";
import { Modal, NumberPadModal, Stepper } from "@/components/controls";
import { Card, Progress, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type Batch = { code: string; target: number; product: string; image: string | null; traySize: number };
type Pad = { title: string; value: number; set: (n: number) => void; decimal?: boolean; unit?: string } | null;

export function OutputStation({ batch, reasons, canShip, initialDone, aiReady, yieldMin }: { batch: Batch; reasons: { key: string; label: string }[]; canShip: boolean; initialDone?: { good: number; reject: number }; aiReady: boolean; yieldMin: number }) {
  const [camera, setCamera] = useState<{ good: number; reject: number; confidence: string } | null>(null);
  const [trays, setTrays] = useState(0);
  const [loose, setLoose] = useState(0);
  const [rej, setRej] = useState<Record<string, number>>(Object.fromEntries(reasons.map((r) => [r.key, 0])));
  const [workers, setWorkers] = useState(0);
  const [hours, setHours] = useState(0);
  const [pad, setPad] = useState<Pad>(null);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ good: number; reject: number } | null>(initialDone ?? null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const good = goodQty(trays, batch.traySize, loose);
  const reject = Object.values(rej).reduce((a, b) => a + b, 0);
  const yld = yieldPct(good, batch.target);
  const rejPct = rejectRate(good, reject);
  const prod = productivity(good, workers, hours);
  const laborOk = workers >= 1 && hours > 0;
  const canSave = good + reject > 0 && laborOk;
  const hrs = (h: number) => num(h, Number.isInteger(h) ? 0 : 1);

  const save = () =>
    start(async () => {
      const r = await saveOutput({ batchCode: batch.code, trays, loose, rejects: rej, workers, hours, camera });
      if (!r.ok) return toast(r.error, "bad");
      setConfirm(false);
      setDone(r.data!);
    });

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-6 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-good-soft text-good">
          <CheckCircle2 className="size-12" />
        </span>
        <h1 className="text-3xl font-extrabold">Hasil produksi tersimpan</h1>
        <p className="text-lg text-ink-2">
          {batch.product} <span className="font-mono font-semibold">{batch.code}</span>: <b className="text-good">{num(done.good)} pcs bagus</b>, {num(done.reject)} reject.
        </p>
        <p className="text-muted">Langkah berikutnya: Packing FG mengirim produk jadi ke Gudang FG atau outlet.</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {canShip && (
            <Link href={`/pengiriman/${batch.code}`} className={btn("primary", "xl")}>
              Kirim produk jadi
            </Link>
          )}
          <Link href="/output" className={btn(canShip ? "secondary" : "primary", "xl")}>
            Catat batch lain
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 station:h-[calc(100dvh-3rem)]">
      {/* baris atas ringkas */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link href="/output" className="inline-flex items-center gap-1 font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-5" /> Daftar batch
        </Link>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
            {batch.image && <Image src={batch.image} alt={batch.product} fill sizes="88px" className="object-contain p-1" priority />}
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-xl font-extrabold">Hasil produksi · {batch.product}</h1>
            <p className="truncate text-sm text-muted">
              <span className="font-mono font-semibold text-ink-2">{batch.code}</span> · Standar output <b className="text-ink">{num(batch.target)} pcs</b>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 station:min-h-0 station:flex-1 station:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* kolom 1: produk bagus + kamera */}
        <Card className="@container flex flex-col gap-1 p-4 station:min-h-0 station:overflow-y-auto">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CheckCircle2 className="size-6 text-good" /> Produk bagus
          </h2>
          <Row icon={<LayoutGrid className="size-6" />} title="Tray penuh" sub={`1 tray = ${batch.traySize} pcs`}>
            <Stepper label="tray penuh" value={trays} onChange={setTrays} onTapValue={() => setPad({ title: "Jumlah tray penuh", value: trays, set: setTrays })} />
          </Row>
          <Row icon={<Shapes className="size-6" />} title="Sisa satuan" sub="Di luar tray penuh">
            <Stepper label="sisa satuan" value={loose} onChange={setLoose} onTapValue={() => setPad({ title: "Sisa satuan (pcs)", value: loose, set: setLoose })} />
          </Row>
          <div className="mt-2 flex flex-col gap-2">
            <CameraCount
              batchCode={batch.code}
              product={batch.product}
              traySize={batch.traySize}
              aiReady={aiReady}
              onApply={(r) => {
                setTrays(r.full_trays);
                setLoose(r.loose);
                setCamera({ good: r.good_total, reject: r.reject_visible, confidence: r.confidence });
                toast(r.reject_visible ? `Angka dari kamera dipakai. AI melihat ${r.reject_visible} reject: isi penyebabnya di bagian Reject.` : "Angka dari kamera dipakai. Periksa sebelum menyimpan.");
              }}
            />
            {camera && (
              <p className="flex items-start gap-2 text-sm text-info">
                <Sparkles className="mt-0.5 size-4 shrink-0" /> Diisi dari kamera ({camera.good} pcs, keyakinan {camera.confidence}). Ubah jika hitungan fisik berbeda.
              </p>
            )}
          </div>
        </Card>

        {/* kolom 2: reject per penyebab + jam kerja */}
        <Card className="@container flex flex-col p-4 station:min-h-0 station:overflow-y-auto">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <XCircle className="size-6 text-bad" /> Produk reject
            <span className="text-sm font-normal text-muted">(tidak lolos QC)</span>
          </h2>
          {reasons.map((r) => (
            <Row key={r.key} title={r.label} dense>
              <Stepper
                size="md"
                label={`reject ${r.label}`}
                value={rej[r.key]}
                onChange={(n) => setRej((x) => ({ ...x, [r.key]: n }))}
                onTapValue={() => setPad({ title: `Reject: ${r.label}`, value: rej[r.key], set: (n) => setRej((x) => ({ ...x, [r.key]: n })) })}
              />
            </Row>
          ))}
          <h2 className="mt-4 flex items-center gap-2 text-lg font-bold">
            <Clock className="size-6 text-info" /> Jam kerja
            <span className="text-sm font-normal text-muted">(untuk produktivitas)</span>
          </h2>
          <Row icon={<Users className="size-5" />} title="Jumlah orang" dense>
            <Stepper size="md" label="jumlah orang" value={workers} max={200} onChange={setWorkers} onTapValue={() => setPad({ title: "Jumlah orang yang bekerja", value: workers, set: (n) => setWorkers(Math.min(200, Math.floor(n))), unit: "orang" })} />
          </Row>
          <Row icon={<Clock className="size-5" />} title="Lama kerja" sub="jam, naik 0,5" dense>
            <Stepper size="md" label="lama kerja (jam)" value={hours} step={0.5} max={24} format={hrs} onChange={setHours} onTapValue={() => setPad({ title: "Lama kerja (jam)", value: hours, set: (n) => setHours(Math.min(24, Math.round(n * 100) / 100)), decimal: true, unit: "jam" })} />
          </Row>
          {!laborOk && <p className="mt-1 text-sm font-medium text-warn">Isi jumlah orang dan lama kerja sebelum menyimpan.</p>}
        </Card>

        {/* kolom 3: ringkasan + simpan */}
        <Card className="flex flex-col gap-3 p-4 md:col-span-2 station:col-span-1 station:min-h-0 station:overflow-y-auto">
          <h2 className="text-lg font-bold">Ringkasan</h2>
          <div>
            <p className="text-sm font-medium text-muted">Produk bagus</p>
            <p className="text-5xl font-extrabold text-good tnum">
              {num(good)} <span className="text-xl text-muted">pcs</span>
            </p>
            <p className="text-sm text-muted tnum">
              {trays} tray × {batch.traySize} + {loose} satuan
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold" title="Produk bagus ÷ standar output BOM">Yield (vs standar BOM)</span>
              <span className={cx("font-bold tnum", yld >= yieldMin - 1e-9 ? "text-good" : "text-warn")}>{pct(yld)}</span>
            </div>
            <Progress value={good} max={batch.target} tone={yld >= yieldMin - 1e-9 ? "good" : "brand"} />
            <p className="text-sm text-muted tnum">
              {good >= batch.target ? `Standar output ${num(batch.target)} pcs tercapai` : `Kurang ${num(batch.target - good)} pcs dari standar ${num(batch.target)}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-sunken p-3">
            <div>
              <dt className="text-sm text-muted">Reject</dt>
              <dd className="text-2xl font-extrabold text-bad tnum">
                {num(reject)} <span className="text-sm font-semibold text-muted">{good + reject ? pct(rejPct) : ""}</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted" title="Produk bagus ÷ (orang × jam)">Produktivitas</dt>
              <dd className="text-2xl font-extrabold tnum">
                {prod != null ? num(prod, 1) : "–"} <span className="text-sm font-semibold text-muted">pcs/orang-jam</span>
              </dd>
            </div>
          </dl>
          <button type="button" disabled={!canSave} onClick={() => setConfirm(true)} className={btn("primary", "xl", "max-md:hidden station:mt-auto")}>
            Simpan hasil produksi
          </button>
        </Card>

        {/* HP: bar simpan menempel di bawah layar */}
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="leading-tight">
            <p className="text-xs text-muted">Bagus · reject</p>
            <p className="text-lg font-extrabold tnum">
              <span className="text-good">{num(good)}</span> · <span className="text-bad">{num(reject)}</span>
            </p>
          </div>
          <button type="button" disabled={!canSave} onClick={() => setConfirm(true)} className={btn("primary", "lg", "flex-1")}>
            Simpan hasil
          </button>
        </div>
      </div>

      <NumberPadModal open={!!pad} onClose={() => setPad(null)} title={pad?.title ?? ""} initial={pad?.value ?? 0} decimal={!!pad?.decimal} unit={pad?.unit} onSubmit={(n) => pad?.set(Math.max(0, pad.decimal ? n : Math.floor(n)))} />

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Periksa sekali lagi"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} onClick={() => setConfirm(false)}>
              Ubah lagi
            </button>
            <button type="button" className={btn("primary", "lg")} disabled={pending} onClick={save}>
              {pending && <Loader2 className="size-5 animate-spin" />} Ya, simpan
            </button>
          </>
        }
      >
        <ul className="flex flex-col divide-y divide-line">
          <li className="flex justify-between py-2"><span>Tray penuh</span><b className="tnum">{trays} × {batch.traySize} pcs</b></li>
          <li className="flex justify-between py-2"><span>Sisa satuan</span><b className="tnum">{loose} pcs</b></li>
          <li className="flex justify-between py-2 text-good"><span className="font-semibold">Total bagus</span><b className="text-lg tnum">{num(good)} pcs</b></li>
          {reasons.filter((r) => rej[r.key] > 0).map((r) => (
            <li key={r.key} className="flex justify-between py-2 text-bad"><span>Reject: {r.label}</span><b className="tnum">{rej[r.key]} pcs</b></li>
          ))}
          <li className="flex justify-between py-2"><span>Jam kerja</span><b className="tnum">{workers} orang × {hrs(hours)} jam</b></li>
        </ul>
        <p className="mt-3 text-sm text-muted">Setelah disimpan, angka tidak bisa diubah dari layar ini.</p>
      </Modal>
    </div>
  );
}

function Row({ icon, title, sub, children, dense }: { icon?: React.ReactNode; title: string; sub?: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-3 border-b border-line last:border-b-0", dense ? "py-2" : "py-3")}>
      <div className="flex items-center gap-3">
        {icon && <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-2 @[25rem]:flex">{icon}</span>}
        <div>
          <p className={cx("font-semibold leading-tight", dense ? "text-[16px]" : "text-lg")}>{title}</p>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
