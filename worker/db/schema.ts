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
