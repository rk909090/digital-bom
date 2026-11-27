import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listBatches, openExceptions, recentResolvedExceptions } from "@/lib/queries";
import { Empty, PageHeader, SectionTitle } from "@/components/ui";
import { ExceptionCard, CloseBatchCard, type ExView } from "./verify-cards";

export const metadata: Metadata = { title: "Verifikasi" };

type ExRow = Awaited<ReturnType<typeof openExceptions>>[number] & { resolver?: { name: string } | null };

function toView(e: ExRow): ExView {
  return {
    id: e.id, code: e.code, type: e.type, status: e.status, batchCode: e.batch.code, product: e.batch.product.name,
    material: e.material?.name ?? null, image: e.material?.image ?? e.batch.product.image, expected: e.expected, actual: e.actual,
    reason: e.reason, createdAt: e.createdAt, createdBy: e.creator?.name ?? "-", resolvedBy: e.resolver?.name ?? null,
    resolvedAt: e.resolvedAt, note: e.resolutionNote,
  };
}

export default async function VerifyPage() {
  await requireUser("verifikasi");
  const [open, resolved, ready] = await Promise.all([openExceptions(), recentResolvedExceptions(6), listBatches({ statuses: ["diterima"] })]);
  const terbuka = open.filter((e) => e.status === "terbuka");
  const investigasi = open.filter((e) => e.status === "investigasi");
  return (
    <>
      <PageHeader title="Verifikasi" subtitle="Periksa penyimpangan yang dilaporkan sistem, lalu tutup batch yang sudah lengkap." />

      <section className="flex flex-col gap-3">
        <SectionTitle>Penyimpangan perlu diperiksa ({terbuka.length})</SectionTitle>
        {terbuka.length === 0 ? (
          <Empty title="Tidak ada penyimpangan baru" icon={<ShieldCheck />}>Sistem akan memberi tahu jika ada berat bahan yang di luar toleransi.</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">{terbuka.map((e) => <ExceptionCard key={e.id} e={toView(e)} />)}</div>
        )}
      </section>

      {investigasi.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Sedang diinvestigasi ({investigasi.length})</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">{investigasi.map((e) => <ExceptionCard key={e.id} e={toView(e)} />)}</div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>Batch siap ditutup ({ready.length})</SectionTitle>
        {ready.length === 0 ? (
          <p className="text-muted">Belum ada batch yang produk jadinya sudah dikirim.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {ready.map((b) => (
              <CloseBatchCard key={b.id} b={{ code: b.code, product: b.product.name, image: b.product.image, target: b.target, good: b.good ?? 0, reject: b.reject ?? 0, received: b.received ?? 0, destination: b.destination, openEx: b.openEx }} />
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Riwayat persetujuan</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">{resolved.map((e) => <ExceptionCard key={e.id} e={toView(e)} />)}</div>
        </section>
      )}
    </>
  );
}

