import { runAgent } from "./agent";

const EVERY_MS = 5 * 60_000;
const g = globalThis as unknown as { __sbAgentTimer?: ReturnType<typeof setInterval> };

/** Menjalankan Digital Agent setiap 5 menit di proses server (lihat docs/FASE-2-SPESIFIKASI.md K20). */
export function startScheduler() {
  if (g.__sbAgentTimer) return;
  const tick = () => runAgent("jadwal").catch((e) => console.error("[agent] gagal", e));
  setTimeout(tick, 15_000); // putaran pertama setelah server siap
  g.__sbAgentTimer = setInterval(tick, EVERY_MS);
  console.log("[agent] penjadwal Digital Agent aktif (setiap 5 menit)");
}
