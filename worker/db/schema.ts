import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Single source of truth for the data model.
 *
 * Every instant is an `integer` of epoch milliseconds in UTC, never text and
 * never a local time: the timezone only exists when the value is shown or when
 * a day is compared (`docs/ARCHITECTURE.md` ADR-006).
 */
export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		notes: text("notes"),
		status: text("status", { enum: ["todo", "done"] })
			.notNull()
			.default("todo"),
		priority: text("priority", { enum: ["low", "medium", "high"] })
			.notNull()
			.default("medium"),
		due_at: integer("due_at", { mode: "number" }),
		completed_at: integer("completed_at", { mode: "number" }),
		created_at: integer("created_at", { mode: "number" }).notNull(),
		updated_at: integer("updated_at", { mode: "number" }).notNull(),
	},
	(table) => [
		// Covers the dominant read: pending tasks ordered by due date, and the
		// `overdue` filter, which is the same predicate on the same column.
		index("tasks_status_due_at_idx").on(table.status, table.due_at),
		// The "Hechas" toggle filters by status and orders by completed date, and
		// the label needs the count, so this index serves the WHERE, the ORDER BY
		// and the walk of the rows it returns.
		index("tasks_status_completed_at_idx").on(table.status, table.completed_at),
	],
);

/**
 * A reminder belongs to exactly one task and is sent by the cron
 * (`docs/ARCHITECTURE.md §3.3`). Rows are never deleted on cancel: the status
 * moves to `cancelled`, so a reminder being cancelled while the job sends it
 * cannot vanish under the job's feet (add-reminders design.md D4).
 *
 * The foreign key cascades, but deleting a task also deletes its reminders
 * explicitly in the same batch: the cascade depends on `PRAGMA foreign_keys`
 * being on for the connection, and a rule the spec promises must not depend on a
 * pragma (design.md D1).
 */
export const reminders = sqliteTable(
	"reminders",
	{
		id: text("id").primaryKey(),
		task_id: text("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		remind_at: integer("remind_at", { mode: "number" }).notNull(),
		// Only `telegram` today; the column exists so a second channel does not
		// need a migration (add-email-channel).
		channel: text("channel", { enum: ["telegram"] })
			.notNull()
			.default("telegram"),
		status: text("status", { enum: ["pending", "sent", "failed", "cancelled"] })
			.notNull()
			.default("pending"),
		attempts: integer("attempts", { mode: "number" }).notNull().default(0),
		last_error: text("last_error"),
		sent_at: integer("sent_at", { mode: "number" }),
		created_at: integer("created_at", { mode: "number" }).notNull(),
	},
	(table) => [
		// The cron's only read: pending reminders whose time has come, oldest first.
		index("reminders_status_remind_at_idx").on(table.status, table.remind_at),
		// The detail (pending reminders of one task, in order) and the next
		// reminder of each task in the list are both a seek on this index.
		index("reminders_task_status_remind_at_idx").on(table.task_id, table.status, table.remind_at),
	],
);
