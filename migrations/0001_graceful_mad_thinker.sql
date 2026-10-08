CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`remind_at` integer NOT NULL,
	`channel` text DEFAULT 'telegram' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_status_remind_at_idx` ON `reminders` (`status`,`remind_at`);--> statement-breakpoint
CREATE INDEX `reminders_task_status_remind_at_idx` ON `reminders` (`task_id`,`status`,`remind_at`);