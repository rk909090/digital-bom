import "server-only";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { db, t } from "@/db";
import { REJECT_REASONS } from "@/db/schema";
import { goodQty } from "./rules";
import { todayISO } from "./format";

export const PERIODS = { hari: { label: "Hari ini", days: 0 }, "7": { label: "7 hari", days: 6 }, "30": { label: "30 hari", days: 29 } } as const;
export type Period = keyof typeof PERIODS;

export function periodRange(p: Period) {
  return { from: todayISO(-PERIODS[p].days), to: todayISO() };
}

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
    return { code: b.code, date: b.date, product: b.product.name, productCode: b.product.code, status: b.status, target: b.target, good, reject, received: b.handover?.qtyReceived ?? null, exceptions: b.exceptions.length };
  });
  const done = batches.filter((b) => b.good != null);
  const sum = (xs: number[]) => xs.reduce((a, c) => a + c, 0);
  const totGood = sum(done.map((b) => b.good!));
  const totReject = sum(done.map((b) => b.reject!));
  const totTarget = sum(done.map((b) => b.target));

  const byProduct = Object.values(
    done.reduce<Record<string, { name: string; batches: number; target: number; good: number; reject: number }>>((acc, b) => {
      const x = (acc[b.productCode] ??= { name: b.product, batches: 0, target: 0, good: 0, reject: 0 });
      x.batches++;
      x.target += b.target;
      x.good += b.good!;
      x.reject += b.reject!;
      return acc;
    }, {}),
  );

  const byDay = Object.values(
    done.reduce<Record<string, { date: string; target: number; good: number; reject: number }>>((acc, b) => {
      const x = (acc[b.date] ??= { date: b.date, target: 0, good: 0, reject: 0 });
      x.target += b.target;
      x.good += b.good!;
      x.reject += b.reject!;
      return acc;
    }, {}),
  );

  const waste = REJECT_REASONS.map((r) => ({ label: r.label, qty: sum(rows.flatMap((b) => b.rejects.filter((x) => x.reason === r.key).map((x) => x.qty))) }))
    .filter((w) => w.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  const matMap: Record<string, { name: string; image: string | null; std: number; actual: number; lines: number; out: number }> = {};
  for (const b of rows)
    for (const m of b.materials) {
      if (m.actualQty == null) continue;
      const x = (matMap[m.material.code] ??= { name: m.material.name, image: m.material.image, std: 0, actual: 0, lines: 0, out: 0 });
      x.std += m.stdQty;
      x.actual += m.actualQty;
      x.lines++;
      if (m.outOfTolerance) x.out++;
    }
  const materials = Object.values(matMap).sort((a, b) => Math.abs((b.actual - b.std) / b.std) - Math.abs((a.actual - a.std) / a.std));

  const ids = rows.map((b) => b.id);
  const exOpen = ids.length ? (await db.query.exceptions.findMany({ where: inArray(t.exceptions.batchId, ids) })).filter((e) => e.status !== "disetujui").length : 0;

  return { from, to, batches, totGood, totReject, totTarget, byProduct, byDay, waste, materials, exOpen, planned: batches.length, finished: done.length };
}
export type Report = Awaited<ReturnType<typeof buildReport>>;
