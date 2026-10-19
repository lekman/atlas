CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`node_stable_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`clients` text NOT NULL,
	`issued_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machines_token_hash_unique` ON `machines` (`token_hash`);