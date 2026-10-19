CREATE TABLE `workstreams` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`order` real,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `items` ADD `workstream_id` text;