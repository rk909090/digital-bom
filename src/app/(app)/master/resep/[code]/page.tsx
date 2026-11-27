import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { listMaterials } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { Card, PageHeader, Thumb } from "@/components/ui";
import { BomEditor } from "./bom-editor";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Resep ${(await params).code}` };
}

export default async function RecipePage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser("master");
  const code = decodeURIComponent((await params).code);
  const product = await db.query.products.findFirst({
    where: eq(t.products.code, code),
    with: { bomVersions: { orderBy: desc(t.bomVersions.version), with: { lines: { orderBy: asc(t.bomLines.sort) }, author: true } } },
  });
  if (!product) notFound();
  const materials = await listMaterials();
  const active = product.bomVersions.find((v) => v.active) ?? product.bomVersions[0];
  return (
    <>
      <PageHeader
        back={{ href: "/master", label: "Resep & Bahan" }}
        title={
          <span className="flex items-center gap-3">
            <Thumb src={product.image} alt={product.name} size={52} /> Resep {product.name}
          </span>
        }
        subtitle={active ? `Versi aktif ${active.version}. Perubahan disimpan sebagai versi ${product.bomVersions[0].version + 1}; batch yang sudah dibuat tetap memakai versi lamanya.` : "Produk baru. Isi bahan dan jumlahnya, lalu simpan."}
      />
      <BomEditor
        product={{ id: product.id, name: product.name, traySize: product.traySize }}
        initial={{ baseQty: active?.baseQty ?? 100, lines: active?.lines.map((l) => ({ materialId: l.materialId, qty: l.qty, tolerancePct: l.tolerancePct })) ?? [] }}
        materials={materials.map((m) => ({ id: m.id, name: m.name, image: m.image, code: m.code }))}
      />
      {product.bomVersions.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">Riwayat versi</h2>
          <ul className="flex flex-col divide-y divide-line">
            {product.bomVersions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="font-bold">Versi {v.version}</span>
                {v.active && <span className="rounded-full bg-good-soft px-2 text-sm font-semibold text-good">aktif</span>}
                <span className="text-muted">{v.lines.length} bahan · 1 batch = {v.baseQty} pcs</span>
                <span className="text-sm text-muted">{v.author?.name ?? "-"} · {dateTime(v.createdAt)}</span>
                {v.note && <span className="w-full text-sm text-ink-2">{v.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
