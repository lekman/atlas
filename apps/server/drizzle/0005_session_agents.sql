CREATE TABLE `session_agents` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`docked` integer NOT NULL,
	`session_name` text NOT NULL,
	`last_state` text NOT NULL,
	`offline_since` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
