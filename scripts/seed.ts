// Buat database baru + data demo:  npm run db:reset
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../src/db/schema";
import { seedDatabase } from "../src/db/seed-data";

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const url = process.env.DATABASE_URL ?? "file:./data/bakery.db";
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedDatabase(db);
  const counts = await Promise.all([
    db.$count(schema.users), db.$count(schema.materials), db.$count(schema.products), db.$count(schema.batches),
  ]);
  console.log(`Selesai: ${counts[0]} pengguna, ${counts[1]} bahan, ${counts[2]} produk, ${counts[3]} batch.`);
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
