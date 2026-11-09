CREATE TABLE `idle_with_work` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`signal_key` text,
	`session` text,
	`since` text,
	`client_id` text,
	`task_ids` text,
	`nudged_at` text
);
