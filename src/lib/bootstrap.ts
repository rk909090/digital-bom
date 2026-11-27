import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, t } from "@/db";
import { seedDatabase } from "@/db/seed-data";

/**
 * Dijalankan sekali saat server start (instrumentation):
 * 1. pastikan folder database ada,
 * 2. jalankan migrasi skema (aman diulang),
 * 3. jika belum ada pengguna sama sekali, isi data demo (kecuali SEED_DEMO=false).
 * Hosting tanpa terminal (mis. Hostinger) tidak perlu menjalankan `npm run db:reset`.
 */
export async function bootstrap() {
  const url = process.env.DATABASE_URL ?? "file:./data/bakery.db";
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    console.error(`[bootstrap] folder migrasi tidak ditemukan: ${migrationsFolder}`);
    return;
  }
  await migrate(db, { migrationsFolder });
  const users = await db.$count(t.users);
  if (users === 0 && process.env.SEED_DEMO !== "false") {
    await seedDatabase(db as unknown as Parameters<typeof seedDatabase>[0]);
    console.log("[bootstrap] database kosong: data demo dibuat");
  }
  console.log(`[bootstrap] database siap (${url.startsWith("file:") ? "file" : "remote"})`);
}
