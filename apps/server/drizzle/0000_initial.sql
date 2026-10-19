CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`runtime` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL,
	`host` text NOT NULL,
	`reach` text NOT NULL,
	`status` text NOT NULL,
	`working_on` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `agent_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`name` text NOT NULL,
	`home` integer
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`decides` text,
	`from_question` text,
	`state` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`received_at` text NOT NULL,
	`type` text NOT NULL,
	`event` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`requirement_id` text,
	`title` text NOT NULL,
	`summary` text,
	`state` text NOT NULL,
	`priority` text NOT NULL,
	`tracker` text,
	`effort` text,
	`value` integer,
	`scheduled_for` text,
	`blocked` integer,
	`done_on` text,
	`details_id` text,
	`history` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`blocks` text NOT NULL,
	`asks` text NOT NULL,
	`state` text NOT NULL,
	`answer` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`boundary` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
