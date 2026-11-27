import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Handshake } from "lucide-react";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/queries";
import { dateTime, num } from "@/lib/format";
import { BatchCard } from "@/components/batch-card";
import { Card, Empty, PageHeader, Pill, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Serah Terima" };

export default async function HandoverList() {
  await requireUser("serahTerima");
  const [list, recent] = await Promise.all([
    listBatches({ statuses: ["output"] }),
    db.query.handovers.findMany({ with: { batch: { with: { product: true } }, receiver: true }, orderBy: desc(t.handovers.receivedAt), limit: 8 }),
  ]);
  return (
    <>
      <PageHeader title="Serah Terima Produk Jadi" subtitle="Gudang menghitung produk bagus dari produksi, lalu mengonfirmasi penerimaan." />
      {list.length === 0 ? (
        <Empty title="Tidak ada produk yang menunggu diterima" icon={<Handshake />}>
          Produk muncul di sini setelah operator mencatat hasil produksi.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((b) => (
            <BatchCard key={b.id} b={b} href={`/serah-terima/${b.code}`} cta="Terima" showDate />
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Riwayat serah terima</SectionTitle>
          <Card className="divide-y divide-line">
            {recent.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-mono font-semibold">{h.code}</span>
                <span className="flex-1">{h.batch.product.name}</span>
                <span className="tnum">
                  diterima <b>{num(h.qtyReceived)}</b> pcs
                </span>
                {h.qtyReceived !== h.qtySent ? <Pill tone="bad">Selisih {h.qtyReceived - h.qtySent > 0 ? "+" : "−"}{Math.abs(h.qtyReceived - h.qtySent)}</Pill> : <Pill tone="good">Sesuai</Pill>}
                <span className="text-sm text-muted">{h.receiver?.name} · {dateTime(h.receivedAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
