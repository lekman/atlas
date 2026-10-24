CREATE TABLE `github_cursor` (
	`id` integer PRIMARY KEY NOT NULL,
	`inode` text NOT NULL,
	`offset` integer NOT NULL,
	`last_key` text
);
--> statement-breakpoint
CREATE TABLE `github_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`event` text NOT NULL,
	`kind` text NOT NULL,
	`repository` text NOT NULL,
	`number` integer NOT NULL,
	`client` text,
	`at` text NOT NULL,
	`applied` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_events_key_unique` ON `github_events` (`key`);--> statement-breakpoint
CREATE TABLE `github_pull_requests` (
	`repository` text NOT NULL,
	`number` integer NOT NULL,
	`closes` text NOT NULL,
	`ci` text,
	`seen_at` text NOT NULL,
	PRIMARY KEY(`repository`, `number`)
);
