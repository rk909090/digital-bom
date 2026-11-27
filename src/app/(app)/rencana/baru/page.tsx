import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listMaterials, productsWithBom, reservedByMaterial } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Rencana Baru" };

export default async function NewPlanPage() {
  await requireUser("rencana");
  const [products, materials, reserved] = await Promise.all([productsWithBom(), listMaterials(), reservedByMaterial()]);
  return (
    <>
      <PageHeader title="Buat rencana produksi" subtitle="Pilih produk dan jumlahnya. Kebutuhan bahan dihitung otomatis dari resep." back={{ href: "/rencana", label: "Rencana" }} />
      <PlanForm
        today={todayISO()}
        tomorrow={todayISO(1)}
        products={products.map((p) => ({
          id: p.id, code: p.code, name: p.name, image: p.image, traySize: p.traySize,
          baseQty: p.bom.baseQty, version: p.bom.version,
          lines: p.bom.lines.map((l) => ({ materialId: l.materialId, qty: l.qty })),
        }))}
        materials={materials.map((m) => ({ id: m.id, name: m.name, image: m.image, stock: m.stock, tracked: m.tracked, available: m.tracked ? Math.max(0, m.stock - (reserved[m.id] ?? 0)) : null }))}
      />
    </>
  );
}
