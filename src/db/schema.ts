import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const ROLES = ["admin", "ppic", "gudang", "gudang_wip", "packing", "operator", "supervisor"] as const;
export type Role = (typeof ROLES)[number];

export const BATCH_STATUS = [
  "menunggu", // belum ada bahan ditimbang
  "ditimbang", // sebagian bahan sudah ditimbang
  "adonan", // semua bahan selesai ditimbang, adonan siap masuk freezer
  "wip", // adonan di freezer (Gudang WIP)
  "produksi", // adonan keluar freezer, sedang dibuat/dipanggang
  "output", // hasil sudah dicatat, menunggu dikirim (Packing FG)
  "diterima", // FG sudah dikirim ke gudang/outlet (disetujui sistem)
  "ditutup",
] as const;
export type BatchStatus = (typeof BATCH_STATUS)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  title: text("title").notNull(),
  pinHash: text("pin_hash").notNull(),
  color: text("color").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const materials = sqliteTable("materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  stock: real("stock").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  tracked: integer("tracked", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  traySize: integer("tray_size").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const bomVersions = sqliteTable("bom_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  version: integer("version").notNull(),
  baseQty: integer("base_qty").notNull(),
  note: text("note"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const bomLines = sqliteTable("bom_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bomVersionId: integer("bom_version_id").notNull().references(() => bomVersions.id),
  materialId: integer("material_id").notNull().references(() => materials.id),
  qty: real("qty").notNull(),
  tolerancePct: real("tolerance_pct").notNull(),
  sort: integer("sort").notNull(),
});

export const productionOrders = sqliteTable("production_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  date: text("date").notNull(), // YYYY-MM-DD (tanggal produksi)
  productId: integer("product_id").notNull().references(() => products.id),
  qty: integer("qty").notNull(),
  bomVersionId: integer("bom_version_id").notNull().references(() => bomVersions.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => productionOrders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  date: text("date").notNull(),
  target: integer("target").notNull(),
  status: text("status", { enum: BATCH_STATUS }).notNull(),
  createdAt: text("created_at").notNull(),
  // tahap WIP (adonan di freezer)
  doughKg: real("dough_kg"),
  wipInAt: text("wip_in_at"),
  wipInBy: integer("wip_in_by").references(() => users.id),
  wipOutAt: text("wip_out_at"),
  wipOutBy: integer("wip_out_by").references(() => users.id),
  closedAt: text("closed_at"),
  closedBy: integer("closed_by").references(() => users.id),
});

export const batchMaterials = sqliteTable("batch_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  materialId: integer("material_id").notNull().references(() => materials.id),
  stdQty: real("std_qty").notNull(),
  tolerancePct: real("tolerance_pct").notNull(),
  sort: integer("sort").notNull(),
  actualQty: real("actual_qty"),
  source: text("source", { enum: ["timbangan", "keypad", "suara"] }),
  weighedBy: integer("weighed_by").references(() => users.id),
  weighedAt: text("weighed_at"),
  outOfTolerance: integer("out_of_tolerance", { mode: "boolean" }).notNull().default(false),
  reason: text("reason"),
});

export const REQUEST_STATUS = ["baru", "disiapkan", "diserahkan"] as const;
export const materialRequests = sqliteTable("material_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => productionOrders.id),
  status: text("status", { enum: REQUEST_STATUS }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  handledBy: integer("handled_by").references(() => users.id),
});

export const materialRequestLines = sqliteTable("material_request_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => materialRequests.id),
  materialId: integer("material_id").notNull().references(() => materials.id),
  qty: real("qty").notNull(),
  shortage: real("shortage").notNull().default(0),
});

export const outputs = sqliteTable("outputs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().unique().references(() => batches.id),
  trays: integer("trays").notNull(),
  loose: integer("loose").notNull(),
  source: text("source", { enum: ["manual", "kamera"] }).notNull().default("manual"),
  // jam kerja untuk produktivitas: jumlah orang x lama kerja (jam)
  workers: integer("workers").notNull().default(0),
  hours: real("hours").notNull().default(0),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: text("recorded_at").notNull(),
});

export const REJECT_REASONS = [
  { key: "proving", label: "Gagal proving" },
  { key: "oven", label: "Gagal oven" },
] as const;

export const outputRejects = sqliteTable("output_rejects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  reason: text("reason").notNull(),
  qty: integer("qty").notNull(),
});

export const handovers = sqliteTable("handovers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().unique().references(() => batches.id),
  code: text("code").notNull().unique(),
  destination: text("destination").notNull().default("Gudang FG"),
  qtySent: integer("qty_sent").notNull(),
  qtyReceived: integer("qty_received").notNull(),
  receivedBy: integer("received_by").references(() => users.id),
  receivedAt: text("received_at").notNull(),
  note: text("note"),
});

export const EXCEPTION_STATUS = ["terbuka", "investigasi", "disetujui"] as const;
export const exceptions = sqliteTable("exceptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["bahan", "serah_terima"] }).notNull(),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  materialId: integer("material_id").references(() => materials.id),
  expected: real("expected").notNull(),
  actual: real("actual").notNull(),
  reason: text("reason"),
  status: text("status", { enum: EXCEPTION_STATUS }).notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: text("resolved_at"),
  resolutionNote: text("resolution_note"),
});

export const stockMoves = sqliteTable("stock_moves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  materialId: integer("material_id").notNull().references(() => materials.id),
  qty: real("qty").notNull(), // + masuk, - keluar
  type: text("type", { enum: ["masuk", "pakai", "koreksi"] }).notNull(),
  ref: text("ref"),
  note: text("note"),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const activity = sqliteTable("activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: text("ts").notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  ref: text("ref"),
  detail: text("detail"),
});

// ---------- relasi (untuk query `with`) ----------
import { relations } from "drizzle-orm";

export const productsRel = relations(products, ({ many }) => ({ bomVersions: many(bomVersions) }));
export const bomVersionsRel = relations(bomVersions, ({ one, many }) => ({
  product: one(products, { fields: [bomVersions.productId], references: [products.id] }),
  lines: many(bomLines),
  author: one(users, { fields: [bomVersions.createdBy], references: [users.id] }),
}));
export const bomLinesRel = relations(bomLines, ({ one }) => ({
  bomVersion: one(bomVersions, { fields: [bomLines.bomVersionId], references: [bomVersions.id] }),
  material: one(materials, { fields: [bomLines.materialId], references: [materials.id] }),
}));
export const ordersRel = relations(productionOrders, ({ one, many }) => ({
  product: one(products, { fields: [productionOrders.productId], references: [products.id] }),
  bomVersion: one(bomVersions, { fields: [productionOrders.bomVersionId], references: [bomVersions.id] }),
  batches: many(batches),
  requests: many(materialRequests),
  author: one(users, { fields: [productionOrders.createdBy], references: [users.id] }),
}));
export const batchesRel = relations(batches, ({ one, many }) => ({
  product: one(products, { fields: [batches.productId], references: [products.id] }),
  order: one(productionOrders, { fields: [batches.orderId], references: [productionOrders.id] }),
  materials: many(batchMaterials),
  output: one(outputs, { fields: [batches.id], references: [outputs.batchId] }),
  rejects: many(outputRejects),
  handover: one(handovers, { fields: [batches.id], references: [handovers.batchId] }),
  exceptions: many(exceptions),
  closer: one(users, { fields: [batches.closedBy], references: [users.id] }),
  wipInUser: one(users, { fields: [batches.wipInBy], references: [users.id] }),
  wipOutUser: one(users, { fields: [batches.wipOutBy], references: [users.id] }),
}));
export const batchMaterialsRel = relations(batchMaterials, ({ one }) => ({
  batch: one(batches, { fields: [batchMaterials.batchId], references: [batches.id] }),
  material: one(materials, { fields: [batchMaterials.materialId], references: [materials.id] }),
  weigher: one(users, { fields: [batchMaterials.weighedBy], references: [users.id] }),
}));
export const requestsRel = relations(materialRequests, ({ one, many }) => ({
  order: one(productionOrders, { fields: [materialRequests.orderId], references: [productionOrders.id] }),
  lines: many(materialRequestLines),
  handler: one(users, { fields: [materialRequests.handledBy], references: [users.id] }),
}));
export const requestLinesRel = relations(materialRequestLines, ({ one }) => ({
  request: one(materialRequests, { fields: [materialRequestLines.requestId], references: [materialRequests.id] }),
  material: one(materials, { fields: [materialRequestLines.materialId], references: [materials.id] }),
}));
export const outputsRel = relations(outputs, ({ one }) => ({
  batch: one(batches, { fields: [outputs.batchId], references: [batches.id] }),
  recorder: one(users, { fields: [outputs.recordedBy], references: [users.id] }),
}));
export const outputRejectsRel = relations(outputRejects, ({ one }) => ({
  batch: one(batches, { fields: [outputRejects.batchId], references: [batches.id] }),
}));
export const handoversRel = relations(handovers, ({ one }) => ({
  batch: one(batches, { fields: [handovers.batchId], references: [batches.id] }),
  receiver: one(users, { fields: [handovers.receivedBy], references: [users.id] }),
}));
export const exceptionsRel = relations(exceptions, ({ one }) => ({
  batch: one(batches, { fields: [exceptions.batchId], references: [batches.id] }),
  material: one(materials, { fields: [exceptions.materialId], references: [materials.id] }),
  creator: one(users, { fields: [exceptions.createdBy], references: [users.id]}),
  resolver: one(users, { fields: [exceptions.resolvedBy], references: [users.id]}),
}));
export const stockMovesRel = relations(stockMoves, ({ one }) => ({
  material: one(materials, { fields: [stockMoves.materialId], references: [materials.id] }),
  user: one(users, { fields: [stockMoves.userId], references: [users.id] }),
}));

// ================= Fase 2: Digital Agent, notifikasi, integrasi =================

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const SEVERITY = ["info", "warn", "bad", "good"] as const;
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  roles: text("roles").notNull(), // daftar peran dipisah koma, mis. ",supervisor,ppic,"
  severity: text("severity", { enum: SEVERITY }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  event: text("event").notNull(),
  dedupeKey: text("dedupe_key").unique(),
});

export const notificationReads = sqliteTable("notification_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notificationId: integer("notification_id").notNull().references(() => notifications.id),
  userId: integer("user_id").notNull().references(() => users.id),
  readAt: text("read_at").notNull(),
});

export const OUTBOX_STATUS = ["menunggu", "terkirim", "gagal", "dilewati"] as const;
export const outbox = sqliteTable("outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notificationId: integer("notification_id").references(() => notifications.id),
  channel: text("channel", { enum: ["telegram", "whatsapp", "email"] }).notNull(),
  recipient: text("recipient").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  status: text("status", { enum: OUTBOX_STATUS }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
});

export const POSTING_TYPES = ["PENERIMAAN_BAHAN", "PEMAKAIAN_BAHAN", "WIP_MASUK", "WIP_KELUAR", "PENGIRIMAN_FG", "PENERIMAAN_FG", "PENYELESAIAN_PRODUKSI"] as const;
export const POSTING_STATUS = ["menunggu", "terkirim", "gagal", "diambil"] as const;
export const postings = sqliteTable("postings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type", { enum: POSTING_TYPES }).notNull(),
  ref: text("ref").notNull(),
  payload: text("payload").notNull(), // JSON
  status: text("status", { enum: POSTING_STATUS }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextAttemptAt: text("next_attempt_at"),
  createdAt: text("created_at").notNull(),
  deliveredAt: text("delivered_at"),
});

export const dailyReports = sqliteTable("daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  data: text("data").notNull(), // JSON angka
  summary: text("summary").notNull(),
  source: text("source", { enum: ["ai", "template"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  trigger: text("trigger").notNull(),
  alerts: integer("alerts").notNull(),
  sent: integer("sent").notNull(),
  posted: integer("posted").notNull(),
  note: text("note"),
});
