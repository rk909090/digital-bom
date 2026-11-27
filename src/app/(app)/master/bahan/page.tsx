import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listMaterials } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { MasterTabs } from "../master-tabs";
import { MaterialsTable } from "./materials-table";

export const metadata: Metadata = { title: "Bahan Baku" };

export default async function MaterialsPage() {
  await requireUser("master");
  const mats = await listMaterials();
  return (
    <>
      <PageHeader title="Resep & Bahan" subtitle="Daftar bahan baku. Stok ditambah lewat menu Gudang dan berkurang otomatis saat bahan ditimbang." />
      <MasterTabs active="bahan" />
      <MaterialsTable materials={mats.map((m) => ({ id: m.id, code: m.code, name: m.name, image: m.image, stock: m.stock, minStock: m.minStock, tracked: m.tracked }))} />
    </>
  );
}
