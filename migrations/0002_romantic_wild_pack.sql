CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`quiet_start` text,
	`quiet_end` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `reminders` ADD `repeat_every` integer;--> statement-breakpoint
ALTER TABLE `reminders` ADD `repeat_unit` text;