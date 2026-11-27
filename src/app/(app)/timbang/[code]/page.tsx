import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBatch } from "@/lib/queries";
import { Empty, btn } from "@/components/ui";
import { WeighStation } from "./weigh-station";
import { WEIGH_REASONS } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Timbang ${(await params).code}` };
}

export default async function WeighPage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser("timbang");
  const { code } = await params;
  const b = await getBatch(decodeURIComponent(code));
  if (!b) notFound();
  const allDone = b.materials.every((m) => m.actualQty != null);
  if (!["menunggu", "ditimbang"].includes(b.status) && !allDone) {
    return (
      <Empty title="Batch ini tidak dalam tahap penimbangan" action={<Link href="/timbang" className={btn("primary", "md")}>Kembali ke daftar</Link>}>
        Status batch {b.code} sudah berubah.
      </Empty>
    );
  }
  return (
    <WeighStation
      reasons={WEIGH_REASONS}
      batch={{ code: b.code, target: b.target, product: b.product.name, image: b.product.image }}
      lines={b.materials.map((m) => ({
        id: m.id, name: m.material.name, image: m.material.image, std: m.stdQty, tol: m.tolerancePct,
        actual: m.actualQty, source: m.source, by: m.weigher?.name ?? null, out: m.outOfTolerance,
      }))}
    />
  );
}
