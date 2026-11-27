import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listMaterials, listRequests, reservedByMaterial } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { GudangView } from "./gudang-view";

export const metadata: Metadata = { title: "Gudang RM" };

export default async function GudangPage() {
  await requireUser("gudang");
  const [open, done, materials, reserved] = await Promise.all([listRequests(["baru", "disiapkan"]), listRequests(["diserahkan"]), listMaterials(), reservedByMaterial()]);
  const mats = materials
    .filter((m) => m.tracked)
    .map((m) => ({ id: m.id, code: m.code, name: m.name, image: m.image, stock: m.stock, minStock: m.minStock, reserved: reserved[m.id] ?? 0 }));
  const req = (list: typeof open) =>
    list.map((r) => ({
      id: r.id, code: r.code, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, handler: r.handler?.name ?? null,
      product: r.order.product.name, productImage: r.order.product.image, orderCode: r.order.code, date: r.order.date, qty: r.order.qty, batches: r.order.batches.length,
      lines: r.lines.map((l) => ({ id: l.id, name: l.material.name, image: l.material.image, qty: l.qty, stock: l.material.stock })),
    }));
  return (
    <>
      <PageHeader title="Gudang RM" subtitle="Siapkan bahan yang diminta produksi, catat barang masuk, dan pantau stok." />
      <GudangView open={req(open)} done={req(done.slice(0, 6))} materials={mats} />
    </>
  );
}
