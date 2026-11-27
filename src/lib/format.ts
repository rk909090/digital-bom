// Format angka & tanggal untuk orang awam (bahasa Indonesia).

const nf = (d: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

export function num(n: number, d = 0): string {
  return nf(d).format(n);
}

/** Berat yang mudah dibaca: < 1 kg ditampilkan dalam gram. */
export function weight(kg: number, opts: { precise?: boolean } = {}): string {
  const a = Math.abs(kg);
  if (a < 1) return `${nf(0).format(kg * 1000)} g`;
  const d = opts.precise ? (a < 3 ? 3 : 2) : a >= 100 ? 1 : 2;
  return `${nf(d).format(kg)} kg`;
}

/** Berat bertanda: +1,20 kg / −300 g */
export function weightSigned(kg: number): string {
  if (Math.abs(kg) < 1e-9) return "pas";
  return `${kg > 0 ? "+" : "−"}${weight(Math.abs(kg))}`;
}

export function pct(x: number, d = 1): string {
  return `${nf(d).format(x * 100)}%`;
}

export function pctSigned(x: number, d = 1): string {
  if (Math.abs(x) < 1e-9) return "0%";
  return `${x > 0 ? "+" : "−"}${nf(d).format(Math.abs(x) * 100)}%`;
}

const TZ = "Asia/Jakarta";

/** Tanggal bisnis hari ini (YYYY-MM-DD) di zona WIB. */
export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function dateLong(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function dateShort(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short" }).format(d);
}

export function time(isoTs: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(isoTs));
}

export function dateTime(isoTs: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(isoTs));
}

export function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

/** 2026-11-27 -> 261127 */
export function yymmdd(iso: string): string {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

/** Waktu server saat render (dipakai untuk "x menit lalu"). */
export function nowMs(): number {
  return Date.now();
}
