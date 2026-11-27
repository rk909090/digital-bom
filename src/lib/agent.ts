import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db, t } from "@/db";
import { notify } from "./notify";
import { dispatchOutbox } from "./channels";
import { deliverPostings } from "./posting";
import { getSettings, num as sNum } from "./settings";
import { buildReport } from "./report";
import { aiReportSummary } from "./ai";
import { goodQty, yieldPct, rejectRate, variance } from "./rules";
import { todayISO, num, pct, pctSigned, weight, dateLong } from "./format";
import { reservedByMaterial } from "./queries";

const HOUR = 3600_000;
const hoursAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / HOUR;

/** Aturan pemantauan (dokumen Fase 2, K21). Mengembalikan jumlah notifikasi baru. */
export async function runMonitor() {
  const s = await getSettings();
  const weighH = sNum(s["rule.weighStaleHours"], 3);
  const handH = sNum(s["rule.handoverStaleHours"], 2);
  const exH = sNum(s["rule.exceptionStaleHours"], 4);
  const achMin = sNum(s["rule.achievementMinPct"], 95) / 100;
  const rejMax = sNum(s["rule.rejectMaxPct"], 2) / 100;
  const today = todayISO();
  let created = 0;
  const add = async (ok: Promise<boolean>) => {
    if (await ok) created++;
  };

  // 1. Batch tertahan di penimbangan
  const weighing = await db.query.batches.findMany({ where: and(inArray(t.batches.status, ["menunggu", "ditimbang"]), lte(t.batches.date, today)), with: { product: true, materials: true } });
  for (const b of weighing) {
    const last = b.materials.map((m) => m.weighedAt).filter(Boolean).sort().at(-1) ?? b.createdAt;
    if (hoursAgo(last!) >= weighH)
      await add(notify({ event: "tertahan_timbang", roles: ["operator", "supervisor"], severity: "warn", title: `${b.code} belum selesai ditimbang`, body: `${b.product.name}: ${b.materials.filter((m) => m.actualQty != null).length}/${b.materials.length} bahan, tidak ada aktivitas lebih dari ${weighH} jam.`, link: `/timbang/${b.code}`, dedupeKey: `tertahan_timbang:${b.code}` }));
  }

  // 1b. Adonan selesai ditimbang tetapi belum masuk freezer (Gudang WIP)
  const doughs = await db.query.batches.findMany({ where: eq(t.batches.status, "adonan"), with: { product: true, materials: true } });
  for (const b of doughs) {
    const last = b.materials.map((m) => m.weighedAt).filter(Boolean).sort().at(-1) ?? b.createdAt;
    if (hoursAgo(last!) >= handH)
      await add(notify({ event: "tertahan_wip", roles: ["gudang_wip", "supervisor"], severity: "warn", title: `Adonan ${b.code} belum masuk freezer`, body: `${b.product.name} selesai ditimbang lebih dari ${handH} jam lalu dan belum dicatat masuk Gudang WIP.`, link: "/wip", dedupeKey: `tertahan_wip:${b.code}` }));
  }

  // 2. Produk jadi belum dikirim (Packing FG)
  const waiting = await db.query.batches.findMany({ where: eq(t.batches.status, "output"), with: { product: true, output: true } });
  for (const b of waiting)
    if (b.output && hoursAgo(b.output.recordedAt) >= handH)
      await add(notify({ event: "tertahan_kirim", roles: ["packing", "supervisor"], severity: "warn", title: `${b.code} belum dikirim`, body: `${b.product.name} ${num(goodQty(b.output.trays, b.product.traySize, b.output.loose))} pcs sudah menunggu dikirim lebih dari ${handH} jam.`, link: `/pengiriman/${b.code}`, dedupeKey: `tertahan_kirim:${b.code}` }));

  // 3. Penyimpangan belum ditangani
  const exs = await db.query.exceptions.findMany({ where: eq(t.exceptions.status, "terbuka"), with: { batch: true, material: true } });
  for (const e of exs)
    if (hoursAgo(e.createdAt) >= exH)
      await add(notify({ event: "pengingat_penyimpangan", roles: ["supervisor"], severity: "bad", title: `Pengingat: ${e.code} belum diperiksa`, body: `${e.type === "bahan" ? `Selisih ${e.material?.name}` : "Selisih serah terima"} pada ${e.batch.code} sudah lebih dari ${exH} jam tanpa keputusan.`, link: "/verifikasi", dedupeKey: `pengingat:${e.code}` }));

  // 4. Stok
  const [mats, reserved] = await Promise.all([db.query.materials.findMany({ where: eq(t.materials.tracked, true) }), reservedByMaterial()]);
  for (const m of mats) {
    const need = reserved[m.id] ?? 0;
    if (need > m.stock + 1e-9)
      await add(notify({ event: "stok_kurang", roles: ["gudang", "ppic"], severity: "bad", title: `Stok ${m.name} tidak cukup untuk rencana`, body: `Dibutuhkan ${weight(need)} untuk batch yang belum ditimbang, stok ${weight(m.stock)}.`, link: "/gudang", dedupeKey: `stok_kurang:${m.code}:${today}` }));
    else if (m.stock < m.minStock)
      await add(notify({ event: "stok_menipis", roles: ["gudang", "ppic"], severity: "warn", title: `Stok ${m.name} menipis`, body: `Stok ${weight(m.stock)}, di bawah minimum ${weight(m.minStock)}.`, link: "/gudang", dedupeKey: `stok_menipis:${m.code}:${today}` }));
  }

  // 5. Pencapaian & reject per batch yang hasilnya sudah dicatat
  const done = await db.query.batches.findMany({ where: and(inArray(t.batches.status, ["output", "diterima", "ditutup"]), eq(t.batches.date, today)), with: { product: true, output: true, rejects: true } });
  for (const b of done) {
    if (!b.output) continue;
    const good = goodQty(b.output.trays, b.product.traySize, b.output.loose);
    const rej = b.rejects.reduce((a, r) => a + r.qty, 0);
    if (yieldPct(good, b.target) < achMin - 1e-9)
      await add(notify({ event: "yield_rendah", roles: ["supervisor", "ppic"], severity: "warn", title: `Yield ${b.code} di bawah ${pct(achMin, 0)}`, body: `${b.product.name}: ${num(good)} pcs bagus dari standar output BOM ${num(b.target)} pcs (yield ${pct(yieldPct(good, b.target))}).`, link: `/batch/${b.code}`, dedupeKey: `yield:${b.code}` }));
    if (good + rej && rejectRate(good, rej) > rejMax + 1e-9)
      await add(notify({ event: "reject_tinggi", roles: ["supervisor"], severity: "warn", title: `Reject ${b.code} di atas ${pct(rejMax, 0)}`, body: `${b.product.name}: ${num(rej)} pcs reject (${pct(rejectRate(good, rej))}).`, link: `/batch/${b.code}`, dedupeKey: `reject:${b.code}` }));
  }
  return created;
}

/** Template ringkasan tanpa AI — selalu tersedia. */
function templateSummary(d: DailyData) {
  const lines = [
    `${dateLong(d.date)}: ${d.batchesFinished} dari ${d.batchesPlanned} batch sudah mencatat hasil. Produk bagus ${num(d.good)} pcs dari standar output BOM ${num(d.target)} pcs (yield ${d.yield}), reject ${num(d.reject)} pcs (${d.rejectPct}).` +
      (d.productivity !== "–" ? ` Produktivitas ${d.productivity}.` : ""),
  ];
  const att: string[] = [];
  if (d.openExceptions) att.push(`${d.openExceptions} penyimpangan belum disetujui supervisor.`);
  if (d.topWaste) att.push(`Reject terbanyak: ${d.topWaste}.`);
  if (d.topVariance) att.push(`Selisih bahan terbesar: ${d.topVariance}.`);
  if (d.batchesUnfinished) att.push(`${d.batchesUnfinished} batch belum selesai.`);
  if (d.lowStock.length) att.push(`Stok menipis: ${d.lowStock.join(", ")}.`);
  lines.push("Perlu perhatian:" + (att.length ? "\n" + att.slice(0, 3).map((a) => `- ${a}`).join("\n") : " tidak ada."));
  return lines.join("\n");
}

type DailyData = Awaited<ReturnType<typeof dailyData>>;

async function dailyData(date: string) {
  const r = await buildReport("hari");
  const mats = await db.query.materials.findMany({ where: eq(t.materials.tracked, true) });
  const top = r.materials[0];
  return {
    date,
    batchesPlanned: r.planned,
    batchesFinished: r.finished,
    batchesUnfinished: r.batches.filter((b) => b.status !== "ditutup" && b.good == null).length,
    target: r.totTarget,
    good: r.totGood,
    reject: r.totReject,
    yield: r.totTarget ? pct(yieldPct(r.totGood, r.totTarget)) : "–",
    rejectPct: r.totGood + r.totReject ? pct(rejectRate(r.totGood, r.totReject)) : "–",
    manHours: Math.round(r.totManHours * 10) / 10,
    productivity: r.totManHours > 0 ? `${num(r.goodWithLabor / r.totManHours, 1)} pcs/orang-jam` : "–",
    perProduct: r.byProduct.map((p) => ({ produk: p.name, batch: p.batches, standar_output: p.target, bagus: p.good, reject: p.reject, orang_jam: Math.round(p.manHours * 10) / 10 })),
    pengiriman: r.byDestination.map((d) => ({ tujuan: d.destination, kiriman: d.shipments, pcs: d.qty })),
    waste: r.waste.map((w) => ({ penyebab: w.label, pcs: w.qty })),
    topWaste: r.waste[0] ? `${r.waste[0].label.toLowerCase()} (${r.waste[0].qty} pcs)` : null,
    topVariance: top && Math.abs(variance(top.actual, top.std)) > 0.01 ? `${top.name.toLowerCase()} ${pctSigned(variance(top.actual, top.std))}` : null,
    openExceptions: r.exOpen,
    lowStock: mats.filter((m) => m.stock < m.minStock).map((m) => m.name),
  };
}

/** Buat (atau buat ulang) laporan harian. */
export async function generateDailyReport(opts: { notifyRoles?: boolean } = {}) {
  const date = todayISO();
  const data = await dailyData(date);
  const ai = await aiReportSummary(data);
  const summary = ai ?? templateSummary(data);
  const source = ai ? "ai" : "template";
  const now = new Date().toISOString();
  const existing = await db.query.dailyReports.findFirst({ where: eq(t.dailyReports.date, date) });
  if (existing) await db.update(t.dailyReports).set({ data: JSON.stringify(data), summary, source, createdAt: now }).where(eq(t.dailyReports.id, existing.id));
  else await db.insert(t.dailyReports).values({ date, data: JSON.stringify(data), summary, source, createdAt: now });
  if (opts.notifyRoles)
    await notify({ event: "laporan_harian", roles: ["supervisor", "ppic"], severity: "info", title: `Laporan produksi ${dateLong(date)}`, body: summary, link: "/laporan?p=hari", dedupeKey: `laporan:${date}` });
  return { date, summary, source };
}

let running = false;

/** Satu putaran Digital Agent: pemantauan, laporan harian terjadwal, kirim notifikasi & posting. */
export async function runAgent(trigger: string) {
  if (running) return { skipped: true as const };
  running = true;
  const startedAt = new Date().toISOString();
  try {
    const alerts = await runMonitor();
    const s = await getSettings();
    let note: string | null = null;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date()));
    if (s["report.enabled"] === "true" && hour >= sNum(s["report.hour"], 17)) {
      const has = await db.query.dailyReports.findFirst({ where: eq(t.dailyReports.date, todayISO()) });
      const announced = await db.query.notifications.findFirst({ where: eq(t.notifications.dedupeKey, `laporan:${todayISO()}`) });
      if (!has || !announced) {
        const r = await generateDailyReport({ notifyRoles: true });
        note = `laporan harian (${r.source})`;
      }
    }
    const sent = await dispatchOutbox();
    const posted = await deliverPostings();
    await db.insert(t.agentRuns).values({ startedAt, trigger, alerts, sent, posted, note });
    return { skipped: false as const, alerts, sent, posted, note };
  } finally {
    running = false;
  }
}

export async function lastRuns(limit = 10) {
  return db.query.agentRuns.findMany({ orderBy: (r, { desc }) => desc(r.id), limit });
}

