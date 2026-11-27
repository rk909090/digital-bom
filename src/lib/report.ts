import "server-only";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { db, t } from "@/db";
import { REJECT_REASONS } from "@/db/schema";
import { goodQty, laborHours } from "./rules";
import { todayISO } from "./format";

export const PERIODS = { hari: { label: "Hari ini", days: 0 }, "7": { label: "7 hari", days: 6 }, "30": { label: "30 hari", days: 29 } } as const;
export type Period = keyof typeof PERIODS;

export function periodRange(p: Period) {
  return { from: todayISO(-PERIODS[p].days), to: todayISO() };
}

type Agg = { target: number; good: number; reject: number; manHours: number };
const addTo = (x: Agg, b: { target: number; good: number | null; reject: number | null; manHours: number }) => {
  x.target += b.target;
  x.good += b.good!;
  x.reject += b.reject!;
  x.manHours += b.manHours;
};

/**
 * Data laporan untuk periode tertentu.
 * - target = standar output BOM (pcs) per batch → yield = bagus ÷ target
 * - manHours = jumlah orang × lama kerja (jam) → produktivitas = bagus ÷ manHours
 */
export async function buildReport(p: Period) {
  const { from, to } = periodRange(p);
  const rows = await db.query.batches.findMany({
    where: and(gte(t.batches.date, from), lte(t.batches.date, to)),
    with: { product: true, output: true, rejects: true, materials: { with: { material: true } }, exceptions: true, handover: true },
    orderBy: [asc(t.batches.date), asc(t.batches.code)],
  });

  const batches = rows.map((b) => {
    const good = b.output ? goodQty(b.output.trays, b.product.traySize, b.output.loose) : null;
    const reject = b.output ? b.rejects.reduce((a, r) => a + r.qty, 0) : null;
    const rejectBy = Object.fromEntries(REJECT_REASONS.map((r) => [r.key, b.rejects.filter((x) => x.reason === r.key).reduce((a, x) => a + x.qty, 0)]));
    return {
      code: b.code, date: b.date, product: b.product.name, productCode: b.product.code, status: b.status, target: b.target, good, reject, rejectBy,
      workers: b.output?.workers ?? 0, hours: b.output?.hours ?? 0, manHours: b.output ? laborHours(b.output.workers, b.output.hours) : 0,
      doughKg: b.doughKg, wipInAt: b.wipInAt, wipOutAt: b.wipOutAt,
      shipped: b.handover?.qtySent ?? null, destination: b.handover?.destination ?? null, shipmentCode: b.handover?.code ?? null, shippedAt: b.handover?.receivedAt ?? null,
      exceptions: b.exceptions.length,
    };
  });
  const done = batches.filter((b) => b.good != null);
  const sum = (xs: number[]) => xs.reduce((a, c) => a + c, 0);
  const totGood = sum(done.map((b) => b.good!));
  const totReject = sum(done.map((b) => b.reject!));
  const totTarget = sum(done.map((b) => b.target));
  const totManHours = sum(done.map((b) => b.manHours));
  /** Bagus dari batch yang jam kerjanya tercatat (untuk produktivitas yang adil). */
  const goodWithLabor = sum(done.filter((b) => b.manHours > 0).map((b) => b.good!));

  const byProduct = Object.values(
    done.reduce<Record<string, Agg & { name: string; batches: number; goodWithLabor: number }>>((acc, b) => {
      const x = (acc[b.productCode] ??= { name: b.product, batches: 0, target: 0, good: 0, reject: 0, manHours: 0, goodWithLabor: 0 });
      x.batches++;
      addTo(x, b);
      if (b.manHours > 0) x.goodWithLabor += b.good!;
      return acc;
    }, {}),
  );

  const byDay = Object.values(
    done.reduce<Record<string, Agg & { date: string }>>((acc, b) => {
      addTo((acc[b.date] ??= { date: b.date, target: 0, good: 0, reject: 0, manHours: 0 }), b);
      return acc;
    }, {}),
  );

  const waste = REJECT_REASONS.map((r) => ({ key: r.key, label: r.label, qty: sum(rows.flatMap((b) => b.rejects.filter((x) => x.reason === r.key).map((x) => x.qty))) }))
    .filter((w) => w.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  const byDestination = Object.values(
    batches.reduce<Record<string, { destination: string; shipments: number; qty: number }>>((acc, b) => {
      if (b.shipped == null || !b.destination) return acc;
      const x = (acc[b.destination] ??= { destination: b.destination, shipments: 0, qty: 0 });
      x.shipments++;
      x.qty += b.shipped;
      return acc;
    }, {}),
  ).sort((a, b) => b.qty - a.qty);

  const matMap: Record<string, { code: string; name: string; image: string | null; std: number; actual: number; lines: number; out: number }> = {};
  for (const b of rows)
    for (const m of b.materials) {
      if (m.actualQty == null) continue;
      const x = (matMap[m.material.code] ??= { code: m.material.code, name: m.material.name, image: m.material.image, std: 0, actual: 0, lines: 0, out: 0 });
      x.std += m.stdQty;
      x.actual += m.actualQty;
      x.lines++;
      if (m.outOfTolerance) x.out++;
    }
  const materials = Object.values(matMap).sort((a, b) => Math.abs((b.actual - b.std) / b.std) - Math.abs((a.actual - a.std) / a.std));

  const ids = rows.map((b) => b.id);
  const exOpen = ids.length ? (await db.query.exceptions.findMany({ where: inArray(t.exceptions.batchId, ids) })).filter((e) => e.status !== "disetujui").length : 0;

  return {
    from, to, batches, totGood, totReject, totTarget, totManHours, goodWithLabor,
    byProduct, byDay, waste, byDestination, materials, exOpen, planned: batches.length, finished: done.length,
  };
}
export type Report = Awaited<ReturnType<typeof buildReport>>;
