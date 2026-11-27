"use client";

// Integrasi timbangan digital lewat Web Serial API (Chrome/Edge, RS232/USB-serial).
// Format yang dikenali (umum di timbangan industri):
//   "ST,GS,+  10.00kg"   "US,NT,+0010.00 kg"   "  10.000 kg"   "W:+0500g"
// BELUM diuji dengan unit timbangan klien — verifikasi format & baud rate saat uji coba.

export type ScaleReading = { kg: number; stable: boolean | null };

export function parseScaleLine(line: string): ScaleReading | null {
  const m = line.match(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (!m) return null;
  let kg = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(kg)) return null;
  if (m[2].toLowerCase() === "g") kg /= 1000;
  const stable = /\bST\b/i.test(line) ? true : /\bUS\b/i.test(line) ? false : null;
  return { kg, stable };
}

type SerialPortLike = {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};
type SerialLike = { requestPort(): Promise<SerialPortLike> };

export function serialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/** Hubungkan ke timbangan. Mengembalikan fungsi untuk memutus. */
export async function connectScale(onReading: (r: ScaleReading) => void, onError: (msg: string) => void, baudRate = 9600): Promise<() => Promise<void>> {
  const serial = (navigator as unknown as { serial: SerialLike }).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate });
  let stop = false;
  const decoder = new TextDecoderStream();
  const closed = port.readable!.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>).catch(() => {});
  const reader = decoder.readable.getReader();
  (async () => {
    let buf = "";
    try {
      while (!stop) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split(/\r?\n|\r/);
        buf = lines.pop() ?? "";
        for (const l of lines) {
          const r = parseScaleLine(l);
          if (r) onReading(r);
        }
      }
    } catch {
      if (!stop) onError("Koneksi timbangan terputus. Periksa kabel lalu hubungkan lagi.");
    }
  })();
  return async () => {
    stop = true;
    await reader.cancel().catch(() => {});
    await closed;
    await port.close().catch(() => {});
  };
}
