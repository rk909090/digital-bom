import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Truck } from "lucide-react";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/queries";
import { dateTime, num } from "@/lib/format";
import { BatchCard } from "@/components/batch-card";
import { Card, Empty, PageHeader, Pill, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Pengiriman FG" };

export default async function ShipList() {
  await requireUser("pengiriman");
  const [list, recent] = await Promise.all([
    listBatches({ statuses: ["output"] }),
    db.query.handovers.findMany({ with: { batch: { with: { product: true } }, receiver: true }, orderBy: desc(t.handovers.receivedAt), limit: 10 }),
  ]);
  return (
    <>
      <PageHeader title="Pengiriman Produk Jadi" subtitle="Packing FG mengirim produk bagus ke Gudang FG atau outlet. Disetujui otomatis oleh sistem." />
      {list.length === 0 ? (
        <Empty title="Tidak ada produk yang menunggu dikirim" icon={<Truck />}>
          Produk muncul di sini setelah operator mencatat hasil produksi.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((b) => (
            <BatchCard key={b.id} b={b} href={`/pengiriman/${b.code}`} cta="Kirim" showDate />
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Riwayat pengiriman</SectionTitle>
          <Card className="divide-y divide-line">
            {recent.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-mono font-semibold">{h.code}</span>
                <span className="flex-1">{h.batch.product.name}</span>
                <span className="tnum">
                  <b>{num(h.qtySent)}</b> pcs
                </span>
                <Pill tone="info">{h.destination}</Pill>
                <span className="text-sm text-muted">
                  {h.receiver?.name} · {dateTime(h.receivedAt)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
