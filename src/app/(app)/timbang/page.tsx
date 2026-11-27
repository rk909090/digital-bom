import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { Scale } from "lucide-react";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { listBatches } from "@/lib/queries";
import { BatchCard } from "@/components/batch-card";
import { Empty, PageHeader, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Timbang Bahan" };

export default async function TimbangList() {
  await requireUser("timbang");
  const list = await listBatches({ statuses: ["ditimbang", "menunggu"] });
  const orderIds = [...new Set(list.map((b) => b.id))];
  const bs = orderIds.length ? await db.query.batches.findMany({ where: inArray(t.batches.id, orderIds), with: { order: { with: { requests: true } } } }) : [];
  const notReady = new Set(bs.filter((b) => b.order.requests.some((r) => r.status !== "diserahkan")).map((b) => b.id));
  const going = list.filter((b) => b.status === "ditimbang");
  const waiting = list.filter((b) => b.status === "menunggu");

  return (
    <>
      <PageHeader title="Timbang Bahan" subtitle="Pilih batch. Layar akan memandu Anda menimbang bahan satu per satu." />
      {list.length === 0 && (
        <Empty title="Tidak ada batch yang perlu ditimbang" icon={<Scale />}>
          Batch baru muncul di sini setelah PPIC membuat rencana produksi.
        </Empty>
      )}
      {going.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Lanjutkan menimbang</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {going.map((b) => (
              <BatchCard key={b.id} b={b} href={`/timbang/${b.code}`} cta="Lanjutkan" showDate />
            ))}
          </div>
        </section>
      )}
      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Belum mulai</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {waiting.map((b) => (
              <div key={b.id} className="flex flex-col gap-1">
                <BatchCard b={b} href={`/timbang/${b.code}`} cta="Mulai timbang" showDate />
                {notReady.has(b.id) && <p className="px-2 text-sm font-medium text-warn">Bahan belum diserahkan gudang. Pastikan bahan sudah tersedia sebelum menimbang.</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
