import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, ClipboardPlus, Handshake, PackageCheck, Scale, ShieldCheck, Warehouse } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { listBatches, navCounts } from "@/lib/queries";
import { dateLong, greeting, todayISO } from "@/lib/format";
import { BatchCard } from "@/components/batch-card";
import { Empty, SectionTitle, cx, btn } from "@/components/ui";

export const metadata: Metadata = { title: "Beranda" };

type Task = { href: string; title: string; count?: number; desc: string; empty: string; icon: React.ComponentType<{ className?: string }>; alert?: boolean };

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [n, today] = await Promise.all([navCounts(), listBatches({ from: todayISO(), to: todayISO() })]);
  const active = (await listBatches({ statuses: ["menunggu", "ditimbang", "produksi", "output", "diterima"] })).filter((b) => b.date !== todayISO());

  const tasks: Task[] = [];
  if (can(user.role, "timbang")) tasks.push({ href: "/timbang", title: "Timbang bahan", count: n.timbang, desc: "batch menunggu ditimbang", empty: "Semua bahan sudah ditimbang", icon: Scale });
  if (can(user.role, "output")) tasks.push({ href: "/output", title: "Catat hasil produksi", count: n.output, desc: "batch sedang diproduksi", empty: "Belum ada batch yang selesai diproduksi", icon: PackageCheck });
  if (can(user.role, "gudang")) tasks.push({ href: "/gudang", title: "Siapkan bahan", count: n.gudang, desc: "permintaan bahan dari produksi", empty: "Tidak ada permintaan bahan", icon: Warehouse });
  if (can(user.role, "serahTerima")) tasks.push({ href: "/serah-terima", title: "Terima hasil produksi", count: n.serahTerima, desc: "batch siap diserahkan ke gudang", empty: "Tidak ada yang perlu diterima", icon: Handshake });
  if (can(user.role, "verifikasi")) tasks.push({ href: "/verifikasi", title: "Periksa & tutup batch", count: n.verifikasi + n.tutup, desc: `${n.verifikasi} penyimpangan · ${n.tutup} batch siap ditutup`, empty: "Tidak ada yang perlu diperiksa", icon: ShieldCheck, alert: n.verifikasi > 0 });
  if (can(user.role, "rencana")) tasks.push({ href: "/rencana/baru", title: "Buat rencana produksi", desc: "Hitung bahan otomatis dari resep", empty: "", icon: ClipboardPlus });
  if (can(user.role, "laporan")) tasks.push({ href: "/laporan", title: "Lihat laporan", desc: "Output, waste, dan yield", empty: "", icon: BarChart3 });

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
        {tasks.map((tk) => {
          const has = tk.count === undefined || tk.count > 0;
          const Icon = tk.icon;
          return (
            <Link
              key={tk.href}
              href={tk.href}
              className={cx(
                "group flex items-center gap-4 rounded-2xl border bg-surface p-5 shadow-card transition hover:shadow-md active:scale-[0.995]",
                tk.alert ? "border-bad-line" : has && tk.count ? "border-brand-line" : "border-line",
              )}
            >
              <span className={cx("flex size-14 shrink-0 items-center justify-center rounded-2xl", tk.alert ? "bg-bad-soft text-bad" : has ? "bg-brand-soft text-brand" : "bg-sunken text-muted")}>
                <Icon className="size-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">{tk.title}</span>
                <span className="mt-0.5 block text-[15px] text-muted">
                  {tk.count === undefined ? tk.desc : tk.count > 0 ? (
                    <>
                      <b className={cx("text-xl tnum", tk.alert ? "text-bad" : "text-ink")}>{tk.count}</b> {tk.desc}
                    </>
                  ) : (
                    tk.empty
                  )}
                </span>
              </span>
              <ArrowRight className="size-6 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          );
        })}
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
