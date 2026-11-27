// Menanam migrasi SQL (folder drizzle/) ke dalam kode: src/db/migrations.generated.ts
// Dibutuhkan karena hosting (mis. Hostinger) hanya menyalin hasil build, bukan folder drizzle/.
// Dijalankan otomatis oleh `npm run db:generate`.
import crypto from "node:crypto";
import fs from "node:fs";

const dir = "drizzle";
const journal = JSON.parse(fs.readFileSync(`${dir}/meta/_journal.json`, "utf8")) as { entries: { tag: string; when: number }[] };
const items = journal.entries.map((e) => {
  const raw = fs.readFileSync(`${dir}/${e.tag}.sql`, "utf8").replace(/\r\n/g, "\n");
  return { tag: e.tag, when: e.when, hash: crypto.createHash("sha256").update(raw).digest("hex"), sql: raw.split("--> statement-breakpoint") };
});
const out = `// File ini dibuat otomatis oleh scripts/embed-migrations.ts dari folder drizzle/. Jangan diedit manual.
export type EmbeddedMigration = { tag: string; when: number; hash: string; sql: string[] };

export const MIGRATIONS: EmbeddedMigration[] = ${JSON.stringify(items, null, 2)};
`;
fs.writeFileSync("src/db/migrations.generated.ts", out);
console.log(`Menanam ${items.length} migrasi ke src/db/migrations.generated.ts`);
