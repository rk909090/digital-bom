import Link from "next/link";
import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateTime, num, weight } from "@/lib/format";
import { Card, PageHeader, Pill, Thumb } from "@/components/ui";
import { MasterTabs } from "./master-tabs";
import { NewProductButton, ResetDemoButton } from "./master-actions";

export const metadata: Metadata = { title: "Resep & Bahan" };

export default async function MasterPage() {
  const user = await requireUser("master");
  const products = await db.query.products.findMany({
    orderBy: asc(t.products.id),
    with: { bomVersions: { where: eq(t.bomVersions.active, true), orderBy: desc(t.bomVersions.version), limit: 1, with: { lines: { with: { material: true }, orderBy: asc(t.bomLines.sort) }, author: true } } },
  });
  return (
    <>
      <PageHeader
        title="Resep & Bahan"
        subtitle="Resep (BOM) menentukan bahan dan jumlahnya untuk setiap batch. Setiap perubahan disimpan sebagai versi baru."
        actions={
          <>
            <NewProductButton />
            {user.role === "admin" && <ResetDemoButton />}
          </>
        }
      />
      <MasterTabs active="resep" />
      <div className="grid gap-4 lg:grid-cols-2">
        {products.map((p) => {
          const bom = p.bomVersions[0];
          return (
            <Link key={p.id} href={`/master/resep/${p.code}`} className="group">
              <Card className="flex h-full flex-col gap-4 p-5 transition group-hover:border-brand group-hover:shadow-md">
                <div className="flex items-center gap-4">
                  <Thumb src={p.image} alt={p.name} size={72} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight">{p.name}</p>
                    <p className="text-sm text-muted">
                      <span className="font-mono font-semibold">{p.code}</span> · 1 tray = {p.traySize} pcs
                    </p>
                    {bom ? <Pill tone="info" className="mt-1">Versi {bom.version} · 1 batch = {num(bom.baseQty)} pcs</Pill> : <Pill tone="warn" className="mt-1">Belum ada resep</Pill>}
                  </div>
                  <ChevronRight className="size-6 text-muted group-hover:text-brand" />
                </div>
                {bom && (
                  <>
                    <ul className="flex flex-wrap gap-1.5">
                      {bom.lines.map((l) => (
                        <li key={l.id} className="rounded-lg bg-sunken px-2.5 py-1 text-sm">
                          {l.material.name} <b className="tnum">{weight(l.qty)}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted">
                      Diubah {bom.author?.name ?? "-"} · {dateTime(bom.createdAt)}
                      {bom.note && ` · ${bom.note}`}
                    </p>
                  </>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
