ALTER TABLE `batches` ADD `dough_kg` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `wip_in_at` text;--> statement-breakpoint
ALTER TABLE `batches` ADD `wip_in_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `batches` ADD `wip_out_at` text;--> statement-breakpoint
ALTER TABLE `batches` ADD `wip_out_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `handovers` ADD `destination` text DEFAULT 'Gudang FG' NOT NULL;--> statement-breakpoint
ALTER TABLE `outputs` ADD `workers` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `outputs` ADD `hours` real DEFAULT 0 NOT NULL;