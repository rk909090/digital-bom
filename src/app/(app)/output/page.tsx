import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/queries";
import { BatchCard } from "@/components/batch-card";
import { Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Hasil Produksi" };

export default async function OutputList() {
  await requireUser("output");
  const list = await listBatches({ statuses: ["produksi"] });
  return (
    <>
      <PageHeader title="Catat Hasil Produksi" subtitle="Pilih batch yang sudah keluar dari oven, lalu hitung tray dan produk reject." />
      {list.length === 0 ? (
        <Empty title="Belum ada batch yang selesai diproduksi" icon={<PackageCheck />}>
          Batch muncul di sini setelah Gudang WIP mencatat adonannya keluar dari freezer.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((b) => (
            <BatchCard key={b.id} b={b} href={`/output/${b.code}`} cta="Catat hasil" showDate />
          ))}
        </div>
      )}
    </>
  );
}
