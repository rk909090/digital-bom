import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, ClipboardPlus, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/queries";
import { dateLong, num } from "@/lib/format";
import { Card, Empty, PageHeader, Pill, Thumb, btn, STATUS } from "@/components/ui";

export const metadata: Metadata = { title: "Rencana Produksi" };

export default async function RencanaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("rencana");
  const sp = await searchParams;
  const orders = await listOrders(30);
  const byDate = orders.reduce<Record<string, typeof orders>>((acc, o) => {
    (acc[o.date] ??= []).push(o);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Rencana Produksi"
        subtitle="Setiap rencana otomatis dipecah menjadi batch, dihitung kebutuhan bahannya dari resep, dan dikirim ke gudang."
        actions={
          <Link href="/rencana/baru" className={btn("primary", "lg")}>
            <Plus className="size-5" /> Buat rencana baru
          </Link>
        }
      />

      {sp.baru && (
        <div className="anim-pop flex items-start gap-3 rounded-2xl border border-good-line bg-good-soft p-4 text-good">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <div>
            <p className="font-bold">Rencana {sp.baru} berhasil dibuat.</p>
            <p className="text-[15px]">
              {sp.batch} batch siap ditimbang. Permintaan bahan {sp.rq} sudah dikirim ke gudang.
              {Number(sp.kurang) > 0 && <b> {sp.kurang} bahan stoknya kurang dan masuk daftar perlu dibeli.</b>}
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <Empty title="Belum ada rencana" icon={<ClipboardPlus />} action={<Link href="/rencana/baru" className={btn("primary", "md")}>Buat rencana pertama</Link>}>
          Mulai dengan memilih produk dan jumlah yang mau dibuat.
        </Empty>
      ) : (
        Object.entries(byDate).map(([date, list]) => (
          <section key={date} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">{dateLong(date)}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {list.map((o) => (
                <Card key={o.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-4">
                    <Thumb src={o.product.image} alt={o.product.name} size={60} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight">{o.product.name}</p>
                      <p className="text-sm text-muted">
                        <span className="font-mono font-semibold text-ink-2">{o.code}</span> · dibuat {o.author?.name ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold tnum">{num(o.qty)}</p>
                      <p className="text-sm text-muted">pcs</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.batches.map((b) => (
                      <Link key={b.id} href={`/batch/${b.code}`} className="rounded-xl border border-line bg-sunken px-3 py-1.5 text-sm hover:border-brand">
                        <span className="font-mono font-semibold">{b.code}</span>
                        <span className="text-muted"> · {num(b.target)} pcs · </span>
                        <Pill tone={STATUS[b.status].tone} className="ml-0.5 !py-0 !text-xs">
                          {STATUS[b.status].label}
                        </Pill>
                      </Link>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
