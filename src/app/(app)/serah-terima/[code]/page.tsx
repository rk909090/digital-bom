import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBatch } from "@/lib/queries";
import { goodQty } from "@/lib/rules";
import { HANDOVER_REASONS } from "@/lib/constants";
import { Empty, btn } from "@/components/ui";
import { HandoverForm } from "./handover-form";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Serah terima ${(await params).code}` };
}

export default async function HandoverPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser("serahTerima");
  const b = await getBatch(decodeURIComponent((await params).code));
  if (!b) notFound();
  if (!b.output) {
    return (
      <Empty title="Batch ini belum bisa diserahkan" action={<Link href={`/batch/${b.code}`} className={btn("primary", "md")}>Lihat detail batch</Link>}>
        Hasil produksi belum dicatat.
      </Empty>
    );
  }
  const ex = b.handover ? b.exceptions.find((e) => e.type === "serah_terima") : undefined;
  const initialDone = b.handover ? { code: b.handover.code, exCode: ex?.code ?? null, received: b.handover.qtyReceived } : undefined;
  const sent = goodQty(b.output.trays, b.product.traySize, b.output.loose);
  const reject = b.rejects.reduce((a, r) => a + r.qty, 0);
  return (
    <HandoverForm
      reasons={HANDOVER_REASONS}
      receiver={user.name}
      initialDone={initialDone}
      data={{
        code: b.code, product: b.product.name, image: b.product.image, traySize: b.product.traySize, date: b.date,
        sent, reject, trays: b.output.trays, loose: b.output.loose, sender: b.output.recorder?.name ?? "-", recordedAt: b.output.recordedAt,
      }}
    />
  );
}
