"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { parseVoiceInput } from "@/app/actions/timbang";
import { isOutOfTolerance } from "@/lib/rules";
import { weight } from "@/lib/format";
import { Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type Line = { id: number; name: string; image: string | null; std: number; tol: number };
type Item = { lineId: number | null; kg: number | null; raw: string; error?: string };

// Web Speech API (Chrome/Edge). Tipe minimal karena belum ada di lib DOM TypeScript.
type Rec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const getSR = () => (typeof window === "undefined" ? null : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Rec) | null);
const noop = () => () => {};

const MIC_ERR: Record<string, string> = {
  "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di browser, atau ketik kalimatnya.",
  "service-not-allowed": "Pengenal suara tidak diizinkan. Ketik kalimatnya saja.",
  "no-speech": "Tidak ada suara terdengar. Tekan tombol lalu bicara lebih dekat ke mikrofon.",
  network: "Pengenal suara butuh internet. Ketik kalimatnya saja.",
  "audio-capture": "Mikrofon tidak ditemukan.",
};

export function VoicePanel({ batchCode, lines, activeLineId, values, onValues, onPick, onSaveAll, saving }: {
  batchCode: string;
  lines: Line[];
  activeLineId: number | null;
  values: Record<number, number>;
  onValues: (v: Record<number, number>) => void;
  onPick: (lineId: number) => void;
  onSaveAll: (ids: number[]) => void;
  saving: boolean;
}) {
  const canSpeak = useSyncExternalStore(noop, () => !!getSR(), () => false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [engine, setEngine] = useState<"ai" | "lokal" | null>(null);
  const [pending, start] = useTransition();
  const rec = useRef<Rec | null>(null);
  const toast = useToast();
  const lineOf = (id: number | null) => lines.find((l) => l.id === id);

  function process(t: string) {
    if (!t.trim()) return;
    start(async () => {
      const r = await parseVoiceInput({ batchCode, transcript: t, activeLineId });
      if (!r.ok) return toast(r.error, "bad");
      const res = r.data!;
      setItems(res.items);
      setEngine(res.engine);
      const next = { ...values };
      for (const i of res.items) if (i.lineId != null && i.kg != null && !i.error) next[i.lineId] = i.kg;
      onValues(next);
      const first = res.items.find((i) => i.lineId != null && i.kg != null && !i.error);
      if (first?.lineId) onPick(first.lineId);
    });
  }

  function toggleMic() {
    if (listening) return rec.current?.stop();
    const SR = getSR();
    if (!SR) return;
    const r = new SR();
    r.lang = "id-ID";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
        else live += res[0].transcript;
      }
      setInterim(live);
      setText(finalText.trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") toast(MIC_ERR[e.error] ?? `Pengenal suara bermasalah (${e.error}).`, "bad");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText.trim()) process(finalText.trim());
    };
    rec.current = r;
    setItems(null);
    setText("");
    setListening(true);
    r.start();
  }

  const okIds = (items ?? [])
    .filter((i) => i.lineId != null && i.kg != null && !i.error && lineOf(i.lineId))
    .filter((i) => !isOutOfTolerance(i.kg!, lineOf(i.lineId)!.std, lineOf(i.lineId)!.tol))
    .map((i) => i.lineId!);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-sunken p-4 text-center">
        {canSpeak ? (
          <>
            <button
              type="button"
              onClick={toggleMic}
              disabled={pending}
              aria-pressed={listening}
              aria-label={listening ? "Berhenti merekam" : "Tekan lalu bicara"}
              className={cx("relative flex size-24 items-center justify-center rounded-full text-white shadow-md transition", listening ? "bg-bad" : "bg-brand hover:bg-brand-hover")}
            >
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-bad/40" />}
              {listening ? <MicOff className="relative size-10" /> : <Mic className="size-10" />}
            </button>
            <p className="font-bold">{listening ? "Mendengarkan… bicara sekarang" : "Tekan lalu bicara"}</p>
            <p className="text-sm text-muted">Contoh: &ldquo;Tepung dua puluh lima kilo, gula lima kilo&rdquo; atau sebut angkanya saja untuk bahan yang dipilih.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Browser ini belum mendukung pengenal suara. Pakai Chrome atau Edge, atau ketik kalimatnya di bawah.</p>
        )}
        {(interim || (listening && text)) && <p className="w-full rounded-xl bg-surface px-3 py-2 text-left text-lg italic text-ink-2">&ldquo;{text} {interim}&rdquo;</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          process(text);
        }}
      >
        <label htmlFor="voice-text" className="sr-only">Kalimat operator</label>
        <input id="voice-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="…atau ketik: butter 10 kilo, ragi 500 gram" className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-base" />
        <button type="submit" disabled={!text.trim() || pending} className={btn("secondary", "md")} aria-label="Proses kalimat">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </form>

      {items && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-muted">
            {engine === "ai" ? <><Sparkles className="size-4 text-info" /> Diurai oleh AI (Claude)</> : "Diurai otomatis"} · periksa sebelum menyimpan
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((i, k) => {
              const l = lineOf(i.lineId);
              const out = l && i.kg != null ? isOutOfTolerance(i.kg, l.std, l.tol) : false;
              return (
                <li key={k}>
                  <button type="button" disabled={!l || !!i.error} onClick={() => l && onPick(l.id)} className={cx("flex w-full items-center gap-3 px-3 py-2.5 text-left", l?.id === activeLineId && "bg-brand-soft")}>
                    {l ? <Thumb src={l.image} alt="" size={40} /> : <span className="flex size-10 items-center justify-center rounded-xl bg-bad-soft text-bad"><AlertTriangle className="size-5" /></span>}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block font-semibold">{l?.name ?? "Tidak dikenali"}</span>
                      <span className="block truncate text-sm text-muted">&ldquo;{i.raw}&rdquo;</span>
                    </span>
                    {i.error ? (
                      <span className="text-right text-sm font-semibold text-bad">{i.error}</span>
                    ) : (
                      <span className="text-right">
                        <b className="block text-lg tnum">{weight(i.kg!)}</b>
                        <span className={cx("text-xs font-bold", out ? "text-bad" : "text-good")}>{out ? "di luar batas" : "pas"}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {okIds.length > 1 && (
            <button type="button" disabled={saving} onClick={() => onSaveAll(okIds)} className={btn("good", "lg")}>
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Simpan {okIds.length} bahan yang pas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
