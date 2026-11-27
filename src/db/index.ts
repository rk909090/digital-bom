import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/bakery.db";

// libSQL membuka file saat klien dibuat: folder harus sudah ada (server baru / path di luar folder aplikasi).
if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });

const g = globalThis as unknown as { __libsql?: Client };
const client = g.__libsql ?? createClient({ url });
if (process.env.NODE_ENV !== "production") g.__libsql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export * as t from "./schema";
