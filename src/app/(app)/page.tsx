import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, ClipboardPlus, PackageCheck, Scale, ShieldCheck, Snowflake, Truck, Warehouse } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { listBatches, navCounts } from "@/lib/queries";
import { dateLong, greeting, todayISO } from "@/lib/format";
import { BatchCard } from "@/components/batch-card";
import { TaskCard, type Task } from "@/components/task-card";
import { Empty, SectionTitle, btn } from "@/components/ui";

export const metadata: Metadata = { title: "Beranda" };


export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [n, today] = await Promise.all([navCounts(), listBatches({ from: todayISO(), to: todayISO() })]);
  const active = (await listBatches({ statuses: ["menunggu", "ditimbang", "adonan", "wip", "produksi", "output", "diterima"] })).filter((b) => b.date !== todayISO());

  const tasks: Task[] = [];
  if (can(user.role, "timbang")) tasks.push({ href: "/timbang", title: "Timbang bahan", icon: Scale, count: n.timbang, unit: "batch", desc: "menunggu ditimbang", empty: "Semua bahan sudah ditimbang" });
  if (can(user.role, "wip")) tasks.push({ href: "/wip", title: "Gudang WIP (freezer)", icon: Snowflake, count: n.wip, unit: "adonan", desc: n.wipReady ? "ada adonan baru, masukkan ke freezer" : "di dalam freezer", detail: `${n.wipReady} siap masuk · ${n.wip - n.wipReady} di dalam freezer`, empty: "Tidak ada adonan di Gudang WIP" });
  if (can(user.role, "output")) tasks.push({ href: "/output", title: "Catat hasil produksi", icon: PackageCheck, count: n.output, unit: "batch", desc: "keluar freezer, siap dicatat hasilnya", empty: "Belum ada batch yang keluar freezer" });
  if (can(user.role, "gudang")) tasks.push({ href: "/gudang", title: "Siapkan bahan (Gudang RM)", icon: Warehouse, count: n.gudang, unit: "permintaan", desc: "bahan dari produksi perlu disiapkan", empty: "Tidak ada permintaan bahan" });
  if (can(user.role, "pengiriman")) tasks.push({ href: "/pengiriman", title: "Kirim produk jadi", icon: Truck, count: n.pengiriman, unit: "batch", desc: "siap dikirim ke gudang/outlet", empty: "Tidak ada yang perlu dikirim" });
  if (can(user.role, "verifikasi")) tasks.push({ href: "/verifikasi", title: "Periksa & tutup batch", icon: ShieldCheck, count: n.verifikasi + n.tutup, unit: "tugas", desc: n.verifikasi ? "ada penyimpangan yang perlu diputuskan" : "batch siap ditutup", detail: `${n.verifikasi} penyimpangan · ${n.tutup} batch siap ditutup`, empty: "Tidak ada yang perlu diperiksa", alert: n.verifikasi > 0 });
  if (can(user.role, "rencana")) tasks.push({ href: "/rencana/baru", title: "Buat rencana produksi", icon: ClipboardPlus, desc: "Hitung bahan otomatis dari resep" });
  if (can(user.role, "laporan")) tasks.push({ href: "/laporan", title: "Lihat laporan", icon: BarChart3, desc: "Yield, reject, produktivitas & Excel" });

  return (
    <>
      {sp.ditolak && (
        <p className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 font-medium text-warn">Halaman itu tidak tersedia untuk peran Anda. Pilih tugas di bawah.</p>
      )}
      <div>
        <p className="text-muted">{dateLong(todayISO())}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {greeting()}, {user.name}
        </h1>
        <p className="mt-1 text-lg text-ink-2">Apa yang ingin Anda kerjakan?</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((tk) => (
          <TaskCard key={tk.href} t={tk} />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle aside={can(user.role, "rencana") ? <Link href="/rencana" className={btn("ghost", "sm")}>Semua rencana</Link> : undefined}>Produksi hari ini</SectionTitle>
        {today.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {today.map((b) => (
              <BatchCard key={b.id} b={b} href={`/batch/${b.code}`} cta="Detail" />
            ))}
          </div>
        ) : (
          <Empty title="Belum ada produksi hari ini" icon={<ClipboardPlus />}>
            {can(user.role, "rencana") ? "Buat rencana produksi untuk memulai." : "PPIC belum membuat rencana untuk hari ini."}
          </Empty>
        )}
      </section>

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Batch hari lain yang belum selesai</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {active.map((b) => (
              <BatchCard key={b.id} b={b} href={`/batch/${b.code}`} cta="Detail" showDate />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
