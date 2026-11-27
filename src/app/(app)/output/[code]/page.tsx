import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { getBatch } from "@/lib/queries";
import { REJECT_REASONS } from "@/db/schema";
import { goodQty } from "@/lib/rules";
import { aiEnabled } from "@/lib/ai";
import { Empty, btn } from "@/components/ui";
import { OutputStation } from "./output-station";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Hasil ${(await params).code}` };
}

export default async function OutputPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser("output");
  const b = await getBatch(decodeURIComponent((await params).code));
  if (!b) notFound();
  if (b.status !== "produksi" && !b.output) {
    return (
      <Empty title="Batch ini belum siap dicatat hasilnya" action={<Link href={`/batch/${b.code}`} className={btn("primary", "md")}>Lihat detail batch</Link>}>
        Semua bahan batch {b.code} harus ditimbang lebih dulu.
      </Empty>
    );
  }
  // jika hasil sudah tersimpan, tampilkan layar "sudah tersimpan" (juga setelah server memuat ulang halaman ini)
  const initialDone = b.output ? { good: goodQty(b.output.trays, b.product.traySize, b.output.loose), reject: b.rejects.reduce((a, r) => a + r.qty, 0) } : undefined;
  return (
    <OutputStation
      batch={{ code: b.code, target: b.target, product: b.product.name, image: b.product.image, traySize: b.product.traySize }}
      reasons={REJECT_REASONS.map((r) => ({ key: r.key, label: r.label }))}
      canHandover={can(user.role, "serahTerima") && b.status === "output"}
      initialDone={initialDone}
      aiReady={aiEnabled()}
    />
  );
}
