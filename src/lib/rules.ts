// Aturan bisnis murni (tanpa database) — dipakai server, klien, dan skrip seed.
// Lihat docs/FASE-0-SPESIFIKASI.md bagian 6.

/** Pecah jumlah rencana menjadi ukuran batch. Sisa yang tidak genap menjadi batch terakhir. */
export function splitBatches(qty: number, baseQty: number): number[] {
  if (qty <= 0 || baseQty <= 0) return [];
  const full = Math.floor(qty / baseQty);
  const rest = qty % baseQty;
  return [...Array(full).fill(baseQty), ...(rest ? [rest] : [])];
}

/** Kebutuhan standar bahan untuk sejumlah pcs, berdasarkan qty BOM per batch dasar. */
export function stdQty(bomQty: number, qty: number, baseQty: number): number {
  return round((bomQty * qty) / baseQty, 4);
}

export function variance(actual: number, std: number): number {
  if (!std) return 0;
  return (actual - std) / std;
}

export function isOutOfTolerance(actual: number, std: number, tolerancePct: number): boolean {
  return Math.abs(variance(actual, std)) > tolerancePct / 100 + 1e-9;
}

/** Batas bawah & atas berat yang masih dalam toleransi. */
export function toleranceRange(std: number, tolerancePct: number): [number, number] {
  return [std * (1 - tolerancePct / 100), std * (1 + tolerancePct / 100)];
}

export function goodQty(trays: number, traySize: number, loose: number): number {
  return trays * traySize + loose;
}

/**
 * Yield (rumus klien, Fase 4): output aktual (produk bagus) ÷ output standar BOM.
 * Output standar BOM untuk satu batch = jumlah pcs yang seharusnya dihasilkan menurut BOM = target batch.
 */
export function yieldPct(good: number, standardOutput: number): number {
  return standardOutput ? good / standardOutput : 0;
}

/** Porsi reject dari semua produk yang dibuat. */
export function rejectRate(good: number, reject: number): number {
  return good + reject ? reject / (good + reject) : 0;
}

/** Produktivitas (rumus klien): output aktual ÷ jam kerja, dengan jam kerja = jumlah orang × lama kerja. Hasil: pcs per orang-jam. */
export function laborHours(workers: number, hours: number): number {
  return Math.max(0, workers) * Math.max(0, hours);
}
export function productivity(good: number, workers: number, hours: number): number | null {
  const h = laborHours(workers, hours);
  return h > 0 ? good / h : null;
}

export function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Resolusi timbangan yang realistis untuk jumlah tertentu (kg). */
export function scaleStep(kg: number): number {
  return kg < 3 ? 0.001 : 0.01;
}
