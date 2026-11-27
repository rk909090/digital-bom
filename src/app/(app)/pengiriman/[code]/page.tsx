import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBatch } from "@/lib/queries";
import { goodQty } from "@/lib/rules";
import { getDestinations } from "@/lib/settings";
import { Empty, btn } from "@/components/ui";
import { ShipForm } from "./ship-form";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Kirim ${(await params).code}` };
}

export default async function ShipPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser("pengiriman");
  const b = await getBatch(decodeURIComponent((await params).code));
  if (!b) notFound();
  if (!b.output) {
    return (
      <Empty title="Batch ini belum bisa dikirim" action={<Link href={`/batch/${b.code}`} className={btn("primary", "md")}>Lihat detail batch</Link>}>
        Hasil produksi belum dicatat.
      </Empty>
    );
  }
  const destinations = await getDestinations();
  // jika sudah dikirim, tampilkan layar "tercatat" (juga setelah server memuat ulang halaman ini)
  const initialDone = b.handover ? { code: b.handover.code, qty: b.handover.qtySent, destination: b.handover.destination } : undefined;
  return (
    <ShipForm
      sender={user.name}
      destinations={destinations}
      initialDone={initialDone}
      data={{
        code: b.code, product: b.product.name, image: b.product.image, traySize: b.product.traySize, date: b.date,
        qty: goodQty(b.output.trays, b.product.traySize, b.output.loose), reject: b.rejects.reduce((a, r) => a + r.qty, 0),
        trays: b.output.trays, loose: b.output.loose, recorder: b.output.recorder?.name ?? "-", recordedAt: b.output.recordedAt,
      }}
    />
  );
}
