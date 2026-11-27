"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, CheckCircle2, ClipboardCheck, Loader2, PackageOpen, ShoppingCart, Truck } from "lucide-react";
import { advanceRequest, receiveStock } from "../../actions/gudang";
import { dateShort, dateTime, num, weight } from "@/lib/format";
import { Modal, Keypad, parseNum } from "@/components/controls";
import { Card, Empty, Pill, SectionTitle, Thumb, btn, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

type Req = {
  id: number; code: string; status: "baru" | "disiapkan" | "diserahkan"; createdAt: string; updatedAt: string; handler: string | null;
  product: string; productImage: string | null; orderCode: string; date: string; qty: number; batches: number;
  lines: { id: number; name: string; image: string | null; qty: number; stock: number }[];
};
type Mat = { id: number; code: string; name: string; image: string | null; stock: number; minStock: number; reserved: number };

const RS = {
  baru: { label: "Baru", tone: "brand" as const, next: "Tandai sudah disiapkan", icon: ClipboardCheck },
  disiapkan: { label: "Sudah disiapkan", tone: "info" as const, next: "Serahkan ke produksi", icon: Truck },
  diserahkan: { label: "Sudah diserahkan", tone: "good" as const, next: "", icon: CheckCircle2 },
};

export function GudangView({ open, done, materials }: { open: Req[]; done: Req[]; materials: Mat[] }) {
  const [tab, setTab] = useState<"minta" | "stok">("minta");
  const toBuy = materials.filter((m) => m.reserved > m.stock || m.stock < m.minStock);
  return (
    <>
      <div className="flex gap-2" role="tablist">
        <TabBtn active={tab === "minta"} onClick={() => setTab("minta")} count={open.length}>
          Permintaan bahan
        </TabBtn>
        <TabBtn active={tab === "stok"} onClick={() => setTab("stok")} count={toBuy.length} alert={toBuy.length > 0}>
          Stok & barang masuk
        </TabBtn>
      </div>
      {tab === "minta" ? <Requests open={open} done={done} /> : <Stock materials={materials} toBuy={toBuy} />}
    </>
  );
}

function TabBtn({ active, onClick, children, count, alert }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number; alert?: boolean }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cx("flex h-12 items-center gap-2 rounded-xl px-4 font-semibold transition", active ? "bg-ink text-white" : "bg-surface border border-line text-ink-2 hover:border-line-strong")}>
      {children}
      {!!count && <span className={cx("min-w-6 rounded-full px-2 text-center text-sm font-extrabold leading-6 tnum", alert ? "bg-bad text-white" : "bg-brand text-white", active && "ring-2 ring-white/70")}>{count}</span>}
    </button>
  );
}

function Requests({ open, done }: { open: Req[]; done: Req[] }) {
  return (
    <div className="flex flex-col gap-6">
      {open.length === 0 ? (
        <Empty title="Tidak ada permintaan bahan" icon={<PackageOpen />}>
          Permintaan baru akan muncul di sini saat PPIC membuat rencana produksi.
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {open.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Sudah diserahkan</SectionTitle>
          <Card className="divide-y divide-line">
            {done.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-mono font-semibold">{r.code}</span>
                <span className="flex-1">{r.product} · {num(r.qty)} pcs · {dateShort(r.date)}</span>
                <span className="text-sm text-muted">oleh {r.handler ?? "-"} · {dateTime(r.updatedAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function RequestCard({ r }: { r: Req }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const s = RS[r.status];
  const Icon = s.icon;
  const short = r.lines.filter((l) => l.stock < l.qty).length;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Thumb src={r.productImage} alt={r.product} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{r.product}</span>
            <Pill tone={s.tone}>{s.label}</Pill>
          </div>
          <p className="text-sm text-muted">
            <span className="font-mono font-semibold text-ink-2">{r.code}</span> · untuk {dateShort(r.date)} · {num(r.qty)} pcs ({r.batches} batch)
          </p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {r.lines.map((l) => {
          const low = l.stock < l.qty;
          return (
            <li key={l.id} className={cx("flex items-center gap-3 rounded-xl border p-2.5", low ? "border-bad-line bg-bad-soft" : "border-line")}>
              <Thumb src={l.image} alt={l.name} size={44} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold">{l.name}</span>
                <span className={cx("text-sm", low ? "font-semibold text-bad" : "text-muted")}>{low ? `Stok hanya ${weight(l.stock)}` : `Stok ${weight(l.stock)}`}</span>
              </span>
              <span className="text-lg font-extrabold tnum">{weight(l.qty)}</span>
            </li>
          );
        })}
      </ul>
      {short > 0 && <p className="text-sm font-semibold text-bad">{short} bahan stoknya tidak cukup. Siapkan yang ada dan beri tahu bagian pembelian.</p>}
      <button
        type="button"
        disabled={pending}
        className={btn(r.status === "baru" ? "primary" : "good", "lg", "w-full")}
        onClick={() =>
          start(async () => {
            const res = await advanceRequest(r.id);
            if (!res.ok) return toast(res.error, "bad");
            toast(res.data!.status === "disiapkan" ? `${r.code} ditandai sudah disiapkan.` : `${r.code} sudah diserahkan ke produksi.`);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
        {s.next}
      </button>
    </Card>
  );
}

function Stock({ materials, toBuy }: { materials: Mat[]; toBuy: Mat[] }) {
  const [sel, setSel] = useState<Mat | null>(null);
  return (
    <div className="flex flex-col gap-6">
      {toBuy.length > 0 && (
        <Card className="flex flex-col gap-3 border-bad-line p-5">
          <SectionTitle>
            <span className="flex items-center gap-2 text-bad">
              <ShoppingCart className="size-5" /> Perlu dibeli
            </span>
          </SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {toBuy.map((m) => {
              const gap = Math.max(m.reserved - m.stock, m.minStock - m.stock, 0);
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-xl bg-bad-soft p-2.5">
                  <Thumb src={m.image} alt={m.name} size={40} />
                  <span className="flex-1 leading-tight">
                    <b className="block">{m.name}</b>
                    <span className="text-sm text-bad">{m.reserved > m.stock ? `Kurang ${weight(m.reserved - m.stock)} untuk produksi` : "Di bawah stok minimum"}</span>
                  </span>
                  <span className="text-right text-sm">
                    beli ≥<b className="block text-base tnum">{weight(gap)}</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <section className="flex flex-col gap-3">
        <SectionTitle>Stok bahan baku</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => {
            const low = m.stock < m.minStock;
            const free = m.stock - m.reserved;
            return (
              <Card key={m.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Thumb src={m.image} alt={m.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{m.name}</p>
                    {low ? <Pill tone="bad">Stok menipis</Pill> : <Pill tone="good">Aman</Pill>}
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">Stok</dt>
                    <dd className="text-lg font-extrabold tnum">{weight(m.stock)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Dipesan</dt>
                    <dd className="text-lg font-bold tnum">{weight(m.reserved)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Sisa</dt>
                    <dd className={cx("text-lg font-bold tnum", free < 0 && "text-bad")}>{weight(free)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => setSel(m)} className={btn("secondary", "md", "w-full")}>
                  <ArrowDownToLine className="size-5" /> Catat barang masuk
                </button>
              </Card>
            );
          })}
        </div>
        <p className="text-sm text-muted">&ldquo;Dipesan&rdquo; = kebutuhan batch yang sudah direncanakan tetapi belum ditimbang. Stok berkurang saat bahan ditimbang di produksi.</p>
      </section>
      <ReceiveModal m={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function ReceiveModal({ m, onClose }: { m: Mat | null; onClose: () => void }) {
  const [v, setV] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const qty = parseNum(v);
  const close = () => {
    setV("");
    setNote("");
    onClose();
  };
  return (
    <Modal
      open={!!m}
      onClose={close}
      title={m ? `Barang masuk: ${m.name}` : ""}
      footer={
        <>
          <button type="button" className={btn("secondary", "lg")} onClick={close}>
            Batal
          </button>
          <button
            type="button"
            disabled={qty <= 0 || pending}
            className={btn("primary", "lg")}
            onClick={() =>
              start(async () => {
                const r = await receiveStock({ materialId: m!.id, qty, note });
                if (!r.ok) return toast(r.error, "bad");
                toast(`${weight(qty)} ${m!.name} ditambahkan ke stok.`);
                close();
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="size-5 animate-spin" />} Tambah ke stok
          </button>
        </>
      }
    >
      {m && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Thumb src={m.image} alt={m.name} size={56} />
            <p className="text-sm text-muted">
              Stok sekarang <b className="text-ink">{weight(m.stock)}</b>
              {qty > 0 && (
                <>
                  {" "}→ menjadi <b className="text-good">{weight(m.stock + qty)}</b>
                </>
              )}
            </p>
          </div>
          <div className="flex items-baseline justify-end gap-2 rounded-xl border border-line bg-sunken px-4 py-3">
            <span className="text-4xl font-extrabold tnum">{v || "0"}</span>
            <span className="text-lg text-muted">kg</span>
          </div>
          <Keypad value={v} onChange={setV} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Catatan (opsional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. No. surat jalan / supplier" className="h-12 rounded-xl border border-line-strong px-3 text-base font-normal" />
          </label>
        </div>
      )}
    </Modal>
  );
}
