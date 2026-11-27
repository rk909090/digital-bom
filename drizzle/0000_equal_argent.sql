CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`ref` text,
	`detail` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `batch_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`std_qty` real NOT NULL,
	`tolerance_pct` real NOT NULL,
	`sort` integer NOT NULL,
	`actual_qty` real,
	`source` text,
	`weighed_by` integer,
	`weighed_at` text,
	`out_of_tolerance` integer DEFAULT false NOT NULL,
	`reason` text,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weighed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`date` text NOT NULL,
	`target` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`closed_at` text,
	`closed_by` integer,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batches_code_unique` ON `batches` (`code`);--> statement-breakpoint
CREATE TABLE `bom_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_version_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`qty` real NOT NULL,
	`tolerance_pct` real NOT NULL,
	`sort` integer NOT NULL,
	FOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`version` integer NOT NULL,
	`base_qty` integer NOT NULL,
	`note` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`batch_id` integer NOT NULL,
	`material_id` integer,
	`expected` real NOT NULL,
	`actual` real NOT NULL,
	`reason` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` integer,
	`resolved_by` integer,
	`resolved_at` text,
	`resolution_note` text,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exceptions_code_unique` ON `exceptions` (`code`);--> statement-breakpoint
CREATE TABLE `handovers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`code` text NOT NULL,
	`qty_sent` integer NOT NULL,
	`qty_received` integer NOT NULL,
	`received_by` integer,
	`received_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handovers_batch_id_unique` ON `handovers` (`batch_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `handovers_code_unique` ON `handovers` (`code`);--> statement-breakpoint
CREATE TABLE `material_request_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`qty` real NOT NULL,
	`shortage` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `material_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `material_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`order_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`handled_by` integer,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `material_requests_code_unique` ON `material_requests` (`code`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`stock` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`tracked` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_code_unique` ON `materials` (`code`);--> statement-breakpoint
CREATE TABLE `output_rejects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`reason` text NOT NULL,
	`qty` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`trays` integer NOT NULL,
	`loose` integer NOT NULL,
	`recorded_by` integer,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outputs_batch_id_unique` ON `outputs` (`batch_id`);--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`date` text NOT NULL,
	`product_id` integer NOT NULL,
	`qty` integer NOT NULL,
	`bom_version_id` integer NOT NULL,
	`created_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_orders_code_unique` ON `production_orders` (`code`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`tray_size` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE TABLE `stock_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`material_id` integer NOT NULL,
	`qty` real NOT NULL,
	`type` text NOT NULL,
	`ref` text,
	`note` text,
	`user_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`pin_hash` text NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
