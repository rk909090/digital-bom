// File ini dibuat otomatis oleh scripts/embed-migrations.ts dari folder drizzle/. Jangan diedit manual.
export type EmbeddedMigration = { tag: string; when: number; hash: string; sql: string[] };

export const MIGRATIONS: EmbeddedMigration[] = [
  {
    "tag": "0000_equal_argent",
    "when": 1795751581510,
    "hash": "b0d61db54cfa834a0aef8b9727d5c9323f0de8315605fb9abc0ff6908066b829",
    "sql": [
      "CREATE TABLE `activity` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`ts` text NOT NULL,\n\t`user_id` integer,\n\t`action` text NOT NULL,\n\t`ref` text,\n\t`detail` text,\n\tFOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `batch_materials` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`batch_id` integer NOT NULL,\n\t`material_id` integer NOT NULL,\n\t`std_qty` real NOT NULL,\n\t`tolerance_pct` real NOT NULL,\n\t`sort` integer NOT NULL,\n\t`actual_qty` real,\n\t`source` text,\n\t`weighed_by` integer,\n\t`weighed_at` text,\n\t`out_of_tolerance` integer DEFAULT false NOT NULL,\n\t`reason` text,\n\tFOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`weighed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `batches` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`order_id` integer NOT NULL,\n\t`product_id` integer NOT NULL,\n\t`date` text NOT NULL,\n\t`target` integer NOT NULL,\n\t`status` text NOT NULL,\n\t`created_at` text NOT NULL,\n\t`closed_at` text,\n\t`closed_by` integer,\n\tFOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `batches_code_unique` ON `batches` (`code`);",
      "\nCREATE TABLE `bom_lines` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`bom_version_id` integer NOT NULL,\n\t`material_id` integer NOT NULL,\n\t`qty` real NOT NULL,\n\t`tolerance_pct` real NOT NULL,\n\t`sort` integer NOT NULL,\n\tFOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `bom_versions` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`product_id` integer NOT NULL,\n\t`version` integer NOT NULL,\n\t`base_qty` integer NOT NULL,\n\t`note` text,\n\t`active` integer DEFAULT true NOT NULL,\n\t`created_at` text NOT NULL,\n\t`created_by` integer,\n\tFOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `exceptions` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`type` text NOT NULL,\n\t`batch_id` integer NOT NULL,\n\t`material_id` integer,\n\t`expected` real NOT NULL,\n\t`actual` real NOT NULL,\n\t`reason` text,\n\t`status` text NOT NULL,\n\t`created_at` text NOT NULL,\n\t`created_by` integer,\n\t`resolved_by` integer,\n\t`resolved_at` text,\n\t`resolution_note` text,\n\tFOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `exceptions_code_unique` ON `exceptions` (`code`);",
      "\nCREATE TABLE `handovers` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`batch_id` integer NOT NULL,\n\t`code` text NOT NULL,\n\t`qty_sent` integer NOT NULL,\n\t`qty_received` integer NOT NULL,\n\t`received_by` integer,\n\t`received_at` text NOT NULL,\n\t`note` text,\n\tFOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `handovers_batch_id_unique` ON `handovers` (`batch_id`);",
      "\nCREATE UNIQUE INDEX `handovers_code_unique` ON `handovers` (`code`);",
      "\nCREATE TABLE `material_request_lines` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`request_id` integer NOT NULL,\n\t`material_id` integer NOT NULL,\n\t`qty` real NOT NULL,\n\t`shortage` real DEFAULT 0 NOT NULL,\n\tFOREIGN KEY (`request_id`) REFERENCES `material_requests`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `material_requests` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`order_id` integer NOT NULL,\n\t`status` text NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`handled_by` integer,\n\tFOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `material_requests_code_unique` ON `material_requests` (`code`);",
      "\nCREATE TABLE `materials` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`name` text NOT NULL,\n\t`image` text,\n\t`stock` real DEFAULT 0 NOT NULL,\n\t`min_stock` real DEFAULT 0 NOT NULL,\n\t`tracked` integer DEFAULT true NOT NULL\n);\n",
      "\nCREATE UNIQUE INDEX `materials_code_unique` ON `materials` (`code`);",
      "\nCREATE TABLE `output_rejects` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`batch_id` integer NOT NULL,\n\t`reason` text NOT NULL,\n\t`qty` integer NOT NULL,\n\tFOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `outputs` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`batch_id` integer NOT NULL,\n\t`trays` integer NOT NULL,\n\t`loose` integer NOT NULL,\n\t`recorded_by` integer,\n\t`recorded_at` text NOT NULL,\n\tFOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `outputs_batch_id_unique` ON `outputs` (`batch_id`);",
      "\nCREATE TABLE `production_orders` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`date` text NOT NULL,\n\t`product_id` integer NOT NULL,\n\t`qty` integer NOT NULL,\n\t`bom_version_id` integer NOT NULL,\n\t`created_by` integer,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`bom_version_id`) REFERENCES `bom_versions`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE UNIQUE INDEX `production_orders_code_unique` ON `production_orders` (`code`);",
      "\nCREATE TABLE `products` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`name` text NOT NULL,\n\t`image` text,\n\t`tray_size` integer NOT NULL,\n\t`active` integer DEFAULT true NOT NULL\n);\n",
      "\nCREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);",
      "\nCREATE TABLE `stock_moves` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`material_id` integer NOT NULL,\n\t`qty` real NOT NULL,\n\t`type` text NOT NULL,\n\t`ref` text,\n\t`note` text,\n\t`user_id` integer,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `users` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`name` text NOT NULL,\n\t`role` text NOT NULL,\n\t`title` text NOT NULL,\n\t`pin_hash` text NOT NULL,\n\t`color` text NOT NULL,\n\t`active` integer DEFAULT true NOT NULL\n);\n"
    ]
  },
  {
    "tag": "0001_odd_jubilee",
    "when": 1795754077793,
    "hash": "ae529de657adde40acba3b168cbb26c1720aa0d0b50388c7c4cb4d8e771c4d01",
    "sql": [
      "CREATE TABLE `agent_runs` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`started_at` text NOT NULL,\n\t`trigger` text NOT NULL,\n\t`alerts` integer NOT NULL,\n\t`sent` integer NOT NULL,\n\t`posted` integer NOT NULL,\n\t`note` text\n);\n",
      "\nCREATE TABLE `daily_reports` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`date` text NOT NULL,\n\t`data` text NOT NULL,\n\t`summary` text NOT NULL,\n\t`source` text NOT NULL,\n\t`created_at` text NOT NULL\n);\n",
      "\nCREATE UNIQUE INDEX `daily_reports_date_unique` ON `daily_reports` (`date`);",
      "\nCREATE TABLE `notification_reads` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`notification_id` integer NOT NULL,\n\t`user_id` integer NOT NULL,\n\t`read_at` text NOT NULL,\n\tFOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `notifications` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`created_at` text NOT NULL,\n\t`roles` text NOT NULL,\n\t`severity` text NOT NULL,\n\t`title` text NOT NULL,\n\t`body` text NOT NULL,\n\t`link` text,\n\t`event` text NOT NULL,\n\t`dedupe_key` text\n);\n",
      "\nCREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);",
      "\nCREATE TABLE `outbox` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`notification_id` integer,\n\t`channel` text NOT NULL,\n\t`recipient` text NOT NULL,\n\t`role` text NOT NULL,\n\t`text` text NOT NULL,\n\t`status` text NOT NULL,\n\t`attempts` integer DEFAULT 0 NOT NULL,\n\t`last_error` text,\n\t`created_at` text NOT NULL,\n\t`sent_at` text,\n\tFOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE no action\n);\n",
      "\nCREATE TABLE `postings` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`code` text NOT NULL,\n\t`type` text NOT NULL,\n\t`ref` text NOT NULL,\n\t`payload` text NOT NULL,\n\t`status` text NOT NULL,\n\t`attempts` integer DEFAULT 0 NOT NULL,\n\t`last_error` text,\n\t`next_attempt_at` text,\n\t`created_at` text NOT NULL,\n\t`delivered_at` text\n);\n",
      "\nCREATE UNIQUE INDEX `postings_code_unique` ON `postings` (`code`);",
      "\nCREATE TABLE `settings` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL,\n\t`updated_at` text NOT NULL\n);\n"
    ]
  },
  {
    "tag": "0002_medical_blackheart",
    "when": 1795756844240,
    "hash": "ff6134a38161ac7a211d8081937c8bb8525803e397d8e803509280efdafd8e41",
    "sql": [
      "ALTER TABLE `outputs` ADD `source` text DEFAULT 'manual' NOT NULL;"
    ]
  }
];
