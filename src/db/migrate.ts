import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Menjalankan migrasi yang ditanam di kode. Perilakunya sama dengan migrator libsql bawaan Drizzle
 * (tabel __drizzle_migrations, dibandingkan lewat created_at), sehingga database yang dulu
 * dimigrasi dengan `drizzle-orm/libsql/migrator` tetap kompatibel.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runMigrations(db: LibSQLDatabase<any>) {
  await db.run(sql`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
  const last = (await db.values<[number, string, number]>(sql`SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`))[0];
  const pending = MIGRATIONS.filter((m) => !last || Number(last[2]) < m.when);
  if (!pending.length) return 0;
  const stmts = pending.flatMap((m) => [
    ...m.sql.filter((s) => s.trim()).map((s) => db.run(sql.raw(s))),
    db.run(sql`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (${m.hash}, ${m.when})`),
  ]);
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  return pending.length;
}
