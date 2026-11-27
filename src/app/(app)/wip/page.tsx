import type { Metadata } from "next";
import { asc, desc, eq, isNotNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { nowMs } from "@/lib/format";
import { WipView } from "./wip-view";

export const metadata: Metadata = { title: "Gudang WIP" };

export default async function WipPage() {
  await requireUser("wip");
  const [ready, inside, history] = await Promise.all([
    db.query.batches.findMany({ where: eq(t.batches.status, "adonan"), with: { product: true, materials: true }, orderBy: [asc(t.batches.date), asc(t.batches.code)] }),
    db.query.batches.findMany({ where: eq(t.batches.status, "wip"), with: { product: true, wipInUser: true }, orderBy: asc(t.batches.wipInAt) }),
    db.query.batches.findMany({ where: isNotNull(t.batches.wipOutAt), with: { product: true, wipOutUser: true }, orderBy: desc(t.batches.wipOutAt), limit: 10 }),
  ]);
  return (
    <WipView
      now={nowMs()}
      ready={ready.map((b) => {
        const weighedAt = b.materials.map((m) => m.weighedAt).filter(Boolean).sort().at(-1) ?? b.createdAt;
        return { code: b.code, date: b.date, product: b.product.name, image: b.product.image, target: b.target, kg: Math.round(b.materials.reduce((a, m) => a + (m.actualQty ?? 0), 0) * 100) / 100, lines: b.materials.length, at: weighedAt! };
      })}
      inside={inside.map((b) => ({ code: b.code, date: b.date, product: b.product.name, image: b.product.image, target: b.target, kg: b.doughKg ?? 0, at: b.wipInAt!, by: b.wipInUser?.name ?? "-" }))}
      history={history.map((b) => ({ code: b.code, product: b.product.name, kg: b.doughKg ?? 0, inAt: b.wipInAt, outAt: b.wipOutAt!, by: b.wipOutUser?.name ?? "-" }))}
    />
  );
}
