CREATE TABLE `dispatch_decisions` (
	`signal_key` text PRIMARY KEY NOT NULL,
	`rule` text NOT NULL,
	`mode` text NOT NULL,
	`outcome` text NOT NULL,
	`repository` text NOT NULL,
	`number` integer NOT NULL,
	`url` text NOT NULL,
	`alert_type` text,
	`severity` text,
	`decided_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dispatch_delegations` (
	`subject` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`delegated_at` text NOT NULL
);
