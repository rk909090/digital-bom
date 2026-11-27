import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getUser } from "@/lib/auth";
import { LoginPanel } from "./login-panel";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

const DEMO_PINS: Record<string, string> = { Admin: "0000", Rina: "1111", Budi: "2222", Sari: "3333", Dewi: "4444", Hendra: "5555", Wawan: "6666", Putri: "7777" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const users = await db.query.users.findMany({ where: eq(t.users.active, true), orderBy: asc(t.users.id) });
  const demo = process.env.DEMO_MODE !== "false";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-14">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <p className="text-lg font-extrabold leading-tight">Smart Bakery Production</p>
          <p className="text-sm text-muted">Digital BOM & pencatatan produksi</p>
        </div>
      </div>
      <LoginPanel
        users={users.map((u) => ({ id: u.id, name: u.name, title: u.title, color: u.color, demoPin: demo ? DEMO_PINS[u.name] : undefined }))}
      />
    </main>
  );
}
