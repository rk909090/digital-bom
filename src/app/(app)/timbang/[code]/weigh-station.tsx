"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, ChevronLeft, Hand, Keyboard, Loader2, Mic, PartyPopper, Plug, Scale, Unplug } from "lucide-react";
import { saveWeighing } from "@/app/actions/timbang";
import { toleranceRange, variance, round } from "@/lib/rules";
import { num, pctSigned, weight } from "@/lib/format";
import { connectScale, serialSupported } from "@/lib/scale";
import { Keypad, Modal, parseNum } from "@/components/controls";
import { Card, Progress, Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { VoicePanel } from "./voice-panel";

type Line = { id: number; name: string; image: string | null; std: number; tol: number; actual: number | null; source: string | null; by: string | null; out: boolean };
type Batch = { code: string; target: number; product: string; image: string | null };
type Mode = "timbangan" | "keypad" | "suara";
type State = "empty" | "settling" | "under" | "ok" | "over";

const noopSubscribe = () => () => {};
// sumber waktu & acak untuk simulasi timbangan (hanya dipanggil dari event, bukan saat render)
const clockNow = () => performance.now();
const rand = () => Math.random();

/** Tampilan berat besar: target < 1 kg ditampilkan dalam gram. */
function bigWeight(kg: number, small: boolean) {
  if (small) return { n: num(kg * 1000), u: "g" };
  return { n: num(kg, 2), u: "kg" };
}

export function WeighStation({ batch, lines: serverLines, reasons }: { batch: Batch; lines: Line[]; reasons: string[] }) {
  const router = useRouter();
  const toast = useToast();
  // hasil simpan lokal agar layar langsung pindah ke bahan berikutnya sebelum data server dimuat ulang
  const [saved, setSaved] = useState<Record<number, { a: number; out: boolean }>>({});
  const lines = useMemo(() => serverLines.map((l) => (l.actual == null && saved[l.id] ? { ...l, actual: saved[l.id].a, out: saved[l.id].out } : l)), [serverLines, saved]);
  const pendingLines = lines.filter((l) => l.actual == null);
  const [activeId, setActiveId] = useState<number | null>(pendingLines[0]?.id ?? null);
  const active = lines.find((l) => l.id === activeId && l.actual == null) ?? pendingLines[0] ?? null;
  const doneCount = lines.length - pendingLines.length;

  const [mode, setMode] = useState<Mode>("timbangan");
  const [w, setW] = useState(0);
  const [stable, setStable] = useState(true);
  const [keyStr, setKeyStr] = useState("");
  const [unit, setUnit] = useState<"kg" | "g">("kg");
  const [outOpen, setOutOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [disconnect, setDisconnect] = useState<null | (() => Promise<void>)>(null);
  const anim = useRef(0);
  const history = useRef<{ kg: number; at: number }[]>([]);

  const small = !!active && active.std < 1;
  const canSerial = useSyncExternalStore(noopSubscribe, serialSupported, () => false);

  // reset input saat bahan berganti (pola "sesuaikan state saat props berubah", tanpa effect)
  const [prevActive, setPrevActive] = useState(active?.id);
  if (active?.id !== prevActive) {
    setPrevActive(active?.id);
    setKeyStr("");
    setReason("");
    setUnit(small ? "g" : "kg");
    if (!disconnect) {
      setW(0);
      setStable(true);
    }
  }
  useEffect(() => cancelAnimationFrame(anim.current), [active?.id]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const [voiceVals, setVoiceVals] = useState<Record<number, number>>({});
  const value = mode === "timbangan" ? w : mode === "suara" ? (active ? voiceVals[active.id] ?? 0 : 0) : unit === "g" ? parseNum(keyStr) / 1000 : parseNum(keyStr);
  const isStable = mode !== "timbangan" || stable;

  const st: State = (() => {
    if (!active || value <= 0) return "empty";
    if (!isStable) return "settling";
    const [lo, hi] = toleranceRange(active.std, active.tol);
    if (value < lo - 1e-9) return "under";
    if (value > hi + 1e-9) return "over";
    return "ok";
  })();

  // ---------- simulasi timbangan (mode latihan) ----------
  function animateTo(target: number) {
    if (!active) return;
    cancelAnimationFrame(anim.current);
    const from = w;
    const res = active.std < 3 ? 1000 : 100;
    const t0 = clockNow();
    const dur = 900;
    setStable(false);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const jitter = k < 1 ? (rand() - 0.5) * Math.max(active.std, 0.2) * 0.06 * (1 - k) : 0;
      setW(Math.max(0, Math.round((from + (target - from) * e + jitter) * res) / res));
      if (k < 1) anim.current = requestAnimationFrame(step);
      else {
        setW(Math.max(0, Math.round(target * res) / res));
        setStable(true);
      }
    };
    anim.current = requestAnimationFrame(step);
  }
  const sim = {
    put: () => active && animateTo(active.std * (1 + (rand() - 0.5) * 0.016)),
    add: () => active && animateTo(w + active.std * 0.03),
    sub: () => active && animateTo(Math.max(0, w - active.std * 0.03)),
    clear: () => animateTo(0),
  };

  // ---------- timbangan sungguhan ----------
  async function connect() {
    try {
      const stop = await connectScale(
        (r) => {
          setW(r.kg);
          if (r.stable != null) setStable(r.stable);
          else {
            const now = Date.now();
            history.current = [...history.current.filter((h) => now - h.at < 800), { kg: r.kg, at: now }];
            const ks = history.current.map((h) => h.kg);
            setStable(ks.length >= 3 && Math.max(...ks) - Math.min(...ks) < 0.0051);
          }
        },
        (msg) => {
          toast(msg, "bad");
          setDisconnect(null);
        },
      );
      setDisconnect(() => stop);
      toast("Timbangan terhubung.");
    } catch {
      toast("Timbangan tidak terhubung. Pilih port timbangan di jendela yang muncul.", "bad");
    }
  }

  function save(withReason?: string) {
    if (!active) return;
    const actual = round(value, 3);
    start(async () => {
      const r = await saveWeighing({ batchMaterialId: active.id, actual, source: mode, reason: withReason });
      if (!r.ok) {
        toast(r.error, "bad");
        return;
      }
      setOutOpen(false);
      setSaved((x) => ({ ...x, [active.id]: { a: actual, out: !!r.data?.exCode } }));
      toast(r.data?.exCode ? `${active.name} disimpan. Supervisor akan memeriksa (${r.data.exCode}).` : `${active.name} ${weight(actual)} tersimpan.`, r.data?.exCode ? "bad" : "good");
      setKeyStr("");
      if (!disconnect) {
        setW(0);
        setStable(true);
      }
      setActiveId(null);
      router.refresh();
    });
  }

  /** Simpan beberapa bahan hasil suara yang semuanya dalam batas. */
  function saveAllVoice(ids: number[]) {
    start(async () => {
      let ok = 0;
      for (const id of ids) {
        const l = lines.find((x) => x.id === id);
        const kg = voiceVals[id];
        if (!l || l.actual != null || kg == null) continue;
        const r = await saveWeighing({ batchMaterialId: id, actual: round(kg, 3), source: "suara" });
        if (!r.ok) {
          toast(`${l.name}: ${r.error}`, "bad");
          break;
        }
        setSaved((x) => ({ ...x, [id]: { a: round(kg, 3), out: !!r.data?.exCode } }));
        ok++;
      }
      if (ok) toast(`${ok} bahan dari suara tersimpan.`);
      setActiveId(null);
      router.refresh();
    });
  }

  function onPrimary() {
    if (st === "under" || st === "over") setOutOpen(true);
    else save();
  }

  // ---------- semua selesai ----------
  if (!active) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 py-6 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-good-soft text-good">
          <PartyPopper className="size-12" />
        </span>
        <h1 className="text-3xl font-extrabold">Semua bahan sudah ditimbang</h1>
        <p className="text-lg text-ink-2">
          Batch <b className="font-mono">{batch.code}</b> ({batch.product}) siap diproduksi.
        </p>
        <Card className="w-full divide-y divide-line text-left">
          {lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <Thumb src={l.image} alt={l.name} size={36} />
              <span className="flex-1 font-semibold">{l.name}</span>
              <span className={cx("font-bold tnum", l.out ? "text-bad" : "text-ink")}>{weight(l.actual ?? 0)}</span>
              {l.out ? <AlertTriangle className="size-5 text-bad" /> : <CheckCircle2 className="size-5 text-good" />}
            </div>
          ))}
        </Card>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Link href="/timbang" className={btn("primary", "xl")}>
            Timbang batch berikutnya
          </Link>
          <Link href="/" className={btn("secondary", "xl")}>
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  const [lo, hi] = toleranceRange(active.std, active.tol);
  const max = hi * 1.18;
  const pos = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  const diff = value - active.std;
  const big = bigWeight(value, small);
  const stepNo = lines.findIndex((l) => l.id === active.id) + 1;

  const MSG: Record<State, { text: string; cls: string; icon: React.ReactNode }> = {
    empty: { text: mode === "timbangan" ? "Taruh bahan di atas timbangan" : mode === "suara" ? "Ucapkan bahan dan beratnya" : "Ketik berat bahan", cls: "bg-sunken text-ink-2", icon: <Hand className="size-7" /> },
    settling: { text: "Tunggu, angka belum stabil…", cls: "bg-sunken text-ink-2", icon: <Loader2 className="size-7 animate-spin" /> },
    under: { text: `Kurang ${weight(-diff)}, tambah lagi`, cls: "bg-info-soft text-info", icon: <ArrowUp className="size-7" /> },
    ok: { text: "Pas! Tekan Simpan", cls: "bg-good-soft text-good", icon: <Check className="size-7" /> },
    over: { text: `Kelebihan ${weight(diff)}, kurangi`, cls: "bg-bad-soft text-bad", icon: <ArrowDown className="size-7" /> },
  };
  const msg = MSG[st];
  const fill = st === "ok" ? "bg-good" : st === "over" ? "bg-bad" : "bg-info";

  return (
    <div className="flex flex-col gap-3 station:h-[calc(100dvh-3rem)]">
      {/* baris atas ringkas */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link href="/timbang" className="inline-flex items-center gap-1 font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-5" /> Daftar batch
        </Link>
        <div className="flex min-w-0 items-center gap-2.5">
          <Thumb src={batch.image} alt={batch.product} size={36} />
          <p className="min-w-0 truncate leading-tight">
            <b>{batch.product}</b>
            <span className="text-sm text-muted">
              {" "}· <span className="font-mono font-semibold">{batch.code}</span> · Target {num(batch.target)} pcs · <span className="tnum">{doneCount}/{lines.length}</span> bahan
            </span>
          </p>
        </div>
      </div>

      {/* daftar bahan sebagai strip (layar sempit / pendek) */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 station:hidden" aria-label="Daftar bahan">
        {lines.map((l, i) => {
          const isActive = l.id === active.id;
          const done = l.actual != null;
          return (
            <button
              key={l.id}
              type="button"
              disabled={done || pending}
              onClick={() => setActiveId(l.id)}
              aria-current={isActive ? "step" : undefined}
              className={cx("flex shrink-0 items-center gap-2 rounded-xl border-2 bg-surface py-1.5 pr-3 pl-1.5 text-left", isActive ? "border-brand bg-brand-soft" : "border-line", done && "opacity-80")}
            >
              <Thumb src={l.image} alt="" size={32} />
              <span className="leading-tight">
                <span className="block text-sm font-semibold whitespace-nowrap">
                  {i + 1}. {l.name}
                </span>
                <span className={cx("text-xs tnum", done ? (l.out ? "font-semibold text-bad" : "font-semibold text-good") : "text-muted")}>{done ? `${weight(l.actual!)} ✓` : weight(l.std)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 station:min-h-0 station:flex-1 station:grid-cols-[210px_minmax(0,1fr)_minmax(0,1fr)] xl:station:grid-cols-[250px_minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* kolom 1: daftar bahan (layar lebar) */}
        <Card className="hidden min-h-0 flex-col gap-2.5 p-3 station:flex">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold">Bahan</h2>
            <span className="text-sm text-muted tnum">
              {doneCount}/{lines.length}
            </span>
          </div>
          <Progress value={doneCount} max={lines.length} />
          <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 [scrollbar-width:thin]">
            {lines.map((l, i) => {
              const isActive = l.id === active.id;
              const done = l.actual != null;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={done || pending}
                    onClick={() => setActiveId(l.id)}
                    aria-current={isActive ? "step" : undefined}
                    className={cx("flex w-full items-center gap-2.5 rounded-xl border-2 p-1.5 text-left transition", isActive ? "border-brand bg-brand-soft" : "border-transparent hover:bg-sunken", done && "opacity-90")}
                  >
                    <span className="relative">
                      <Thumb src={l.image} alt="" size={38} />
                      {done && (
                        <span className={cx("absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-white", l.out ? "bg-bad" : "bg-good")}>
                          {l.out ? <AlertTriangle className="size-3" /> : <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[15px] font-semibold">
                        <span className="text-muted tnum">{i + 1}.</span> {l.name}
                      </span>
                      <span className={cx("text-sm tnum", done ? (l.out ? "font-semibold text-bad" : "font-semibold text-good") : "text-muted")}>{done ? `${weight(l.actual!)} ✓` : weight(l.std)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* kolom 2: bahan aktif, angka, indikator, simpan */}
        <Card className="flex flex-col gap-3 p-4 station:min-h-0 station:overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-white xl:size-24">
              {active.image && <Image src={active.image} alt={active.name} fill sizes="192px" className="object-contain p-1.5" priority />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-brand">
                Bahan {stepNo} dari {lines.length}
              </p>
              <h1 className="text-2xl font-extrabold leading-tight xl:text-3xl">{active.name}</h1>
              <p className="text-[17px]">
                Ambil <b className="text-xl tnum">{weight(active.std)}</b>
              </p>
              <p className="text-sm text-muted tnum">
                Boleh {weight(lo)} – {weight(hi)} (±{num(active.tol, 0)}%)
              </p>
            </div>
          </div>

          {/* angka & indikator */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sunken p-4">
            <div className="flex items-end justify-between gap-3">
              <div aria-live="polite" className="min-w-0">
                <span className="text-5xl font-extrabold tracking-tight tnum xl:text-6xl">{big.n}</span>
                <span className="ml-1.5 text-xl font-bold text-muted">{big.u}</span>
              </div>
              {mode === "timbangan" && (
                <span className={cx("mb-1 shrink-0 rounded-full px-3 py-1 text-sm font-bold", st === "settling" ? "bg-warn-soft text-warn" : "border border-line bg-surface text-muted")}>{st === "settling" ? "Bergerak" : "Stabil"}</span>
              )}
            </div>
            {/* gauge */}
            <div className="relative h-7" aria-hidden="true">
              <div className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full border border-line bg-surface" />
              <div className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-good-soft ring-2 ring-good/50" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
              <div className={cx("absolute left-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full opacity-80 transition-[width] duration-100", fill)} style={{ width: pos(value) }} />
              <div className="absolute top-0 h-7 w-1 -translate-x-1/2 rounded bg-ink" style={{ left: pos(active.std) }} />
            </div>
            <div className="flex justify-between text-xs font-semibold text-muted">
              <span>0</span>
              <span className="text-good">zona pas</span>
              <span>{weight(max)}</span>
            </div>
            <div className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-lg font-bold leading-tight", msg.cls)}>
              {msg.icon}
              <span className="min-w-0">{msg.text}</span>
              {st !== "empty" && st !== "settling" && <span className="ml-auto shrink-0 text-base font-semibold opacity-80 tnum">{pctSigned(variance(value, active.std))}</span>}
            </div>
          </div>

          <button type="button" disabled={st === "empty" || st === "settling" || pending} onClick={onPrimary} className={btn(st === "ok" ? "good" : "primary", "xl", "max-md:hidden station:mt-auto")}>
            {pending ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-6" />}
            Simpan & lanjut
          </button>
        </Card>

        {/* kolom 3: cara input */}
        <Card className="flex flex-col gap-3 p-4 station:min-h-0 station:overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-sunken p-1.5" role="tablist" aria-label="Cara memasukkan berat">
            {(
              [
                ["timbangan", "Timbangan", Scale],
                ["keypad", "Ketik", Keyboard],
                ["suara", "Suara", Mic],
              ] as const
            ).map(([k, label, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cx("flex h-11 items-center justify-center gap-1.5 rounded-xl font-semibold transition", mode === k ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
                <Icon className="size-5 shrink-0" /> {label}
              </button>
            ))}
          </div>

          {mode === "timbangan" ? (
            disconnect ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good-line bg-good-soft px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-good">
                  <Plug className="size-5" /> Timbangan terhubung. Angka masuk otomatis.
                </span>
                <button
                  type="button"
                  className={btn("ghost", "sm")}
                  onClick={async () => {
                    await disconnect();
                    setDisconnect(null);
                  }}
                >
                  <Unplug className="size-4" /> Putuskan
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-3">
                <p className="text-sm text-ink-2">
                  <b>Mode latihan.</b> Belum ada timbangan terhubung. Pakai tombol di bawah untuk mencoba.
                </p>
                {canSerial && (
                  <button type="button" onClick={connect} className={btn("secondary", "sm", "self-start")}>
                    <Plug className="size-4" /> Hubungkan timbangan
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={sim.put} className={btn("secondary", "md")}>Taruh bahan</button>
                  <button type="button" onClick={sim.add} className={btn("secondary", "md")}>+ Tambah sedikit</button>
                  <button type="button" onClick={sim.sub} className={btn("secondary", "md")}>− Kurangi sedikit</button>
                  <button type="button" onClick={sim.clear} className={btn("ghost", "md")}>Kosongkan</button>
                </div>
              </div>
            )
          ) : mode === "suara" ? (
            <VoicePanel
              batchCode={batch.code}
              lines={pendingLines.map((l) => ({ id: l.id, name: l.name, image: l.image, std: l.std, tol: l.tol }))}
              activeLineId={active.id}
              values={voiceVals}
              onValues={setVoiceVals}
              onPick={(id) => setActiveId(id)}
              onSaveAll={saveAllVoice}
              saving={pending}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-stretch gap-2">
                <div className="flex min-w-0 flex-1 items-baseline justify-end gap-2 rounded-xl border border-line-strong bg-surface px-3 py-1.5">
                  <span className="truncate text-3xl font-extrabold tnum">{keyStr || "0"}</span>
                  <span className="text-muted">{unit === "g" ? "gram" : "kg"}</span>
                </div>
                <div className="flex shrink-0 rounded-xl border border-line-strong p-1" role="group" aria-label="Satuan">
                  {(["kg", "g"] as const).map((u) => (
                    <button key={u} type="button" onClick={() => { setUnit(u); setKeyStr(""); }} aria-pressed={unit === u} className={cx("min-w-14 rounded-lg px-2 font-bold", unit === u ? "bg-ink text-white" : "text-muted")}>
                      {u === "kg" ? "kg" : "gram"}
                    </button>
                  ))}
                </div>
              </div>
              <Keypad value={keyStr} onChange={setKeyStr} decimal={unit === "kg"} compact />
            </div>
          )}
        </Card>

        {/* HP: bar simpan menempel di bawah layar */}
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="min-w-0 leading-tight">
            <p className="text-xs text-muted">{active.name}</p>
            <p className={cx("text-lg font-extrabold tnum", st === "ok" ? "text-good" : st === "over" ? "text-bad" : st === "under" ? "text-info" : "text-ink")}>
              {big.n} {big.u}
            </p>
          </div>
          <button type="button" disabled={st === "empty" || st === "settling" || pending} onClick={onPrimary} className={btn(st === "ok" ? "good" : "primary", "lg", "flex-1")}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            Simpan & lanjut
          </button>
        </div>
      </div>

      <Modal
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title="Beratnya belum pas"
        footer={
          <>
            <button type="button" className={btn("secondary", "lg")} disabled={!reason || pending} onClick={() => save(reason)}>
              {pending && <Loader2 className="size-5 animate-spin" />} Tetap simpan
            </button>
            <button type="button" className={btn("primary", "lg")} onClick={() => setOutOpen(false)}>
              Timbang ulang
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-sunken p-3 text-center">
            <div>
              <p className="text-sm text-muted">Target</p>
              <p className="text-lg font-bold tnum">{weight(active.std)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Ditimbang</p>
              <p className="text-lg font-bold tnum">{weight(value)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Selisih</p>
              <p className="text-lg font-bold text-bad tnum">{pctSigned(variance(value, active.std))}</p>
            </div>
          </div>
          <p>
            Sebaiknya <b>timbang ulang</b> sampai masuk zona hijau. Jika tetap disimpan, pilih alasannya. Supervisor akan diberi tahu dan batch belum bisa ditutup sebelum diperiksa.
          </p>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-sm font-semibold">Alasan</legend>
            {reasons.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={cx("h-11 rounded-full border px-4 font-semibold", reason === r ? "border-ink bg-ink text-white" : "border-line-strong bg-surface")}>
                {r}
              </button>
            ))}
          </fieldset>
        </div>
      </Modal>
    </div>
  );
}
