import { db, t } from "@/db";
import { runMigrations } from "@/db/migrate";
import { seedDatabase } from "@/db/seed-data";

/**
 * Dijalankan sekali saat server start (instrumentation):
 * 1. jalankan migrasi skema yang ditanam di kode (aman diulang),
 * 2. jika belum ada pengguna sama sekali, isi data demo (kecuali SEED_DEMO=false).
 * Hosting tanpa terminal (mis. Hostinger) tidak perlu menjalankan `npm run db:reset`.
 * Folder database dibuat otomatis oleh src/db/index.ts.
 */
export async function bootstrap() {
  const url = process.env.DATABASE_URL ?? "file:./data/bakery.db";
  const applied = await runMigrations(db as unknown as Parameters<typeof runMigrations>[0]);
  if (applied) console.log(`[bootstrap] ${applied} migrasi dijalankan`);
  const users = await db.$count(t.users);
  if (users === 0 && process.env.SEED_DEMO !== "false") {
    await seedDatabase(db as unknown as Parameters<typeof seedDatabase>[0]);
    console.log("[bootstrap] database kosong: data demo dibuat");
  }
  console.log(`[bootstrap] database siap (${url.startsWith("file:") ? "file" : "remote"})`);
}
