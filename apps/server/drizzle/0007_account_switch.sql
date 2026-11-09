CREATE TABLE `account_limits` (
	`account` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`resets_at` text,
	`seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_switch_decisions` (
	`signal_key` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`from_account` text,
	`to_account` text,
	`mode` text NOT NULL,
	`outcome` text NOT NULL,
	`decided_at` text NOT NULL
);
