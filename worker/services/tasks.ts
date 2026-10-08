import { dueDateToEpochMs, zonedDayStart } from "@shared/dates";
import type { CreateTaskInput, TaskStatus, UpdateTaskInput } from "@shared/tasks";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, getTableColumns, isNotNull, lt, sql } from "drizzle-orm";
import type { NexusDb } from "../db/client";
import { reminders, tasks } from "../db/schema";

/**
 * All the rules of a task, with no HTTP in sight: it receives an already
 * validated input and the timezone, and returns rows.
 *
 * Every read is a single query and every mutation a single write, because the
 * free plan counts both (`AGENTS.md §8`) and there is exactly one person using
 * this. The cost of each call is in `design.md`, "Coste en el plan gratuito".
 */

export type Task = InferSelectModel<typeof tasks>;

/**
 * A task as the **list** returns it: the row plus the instant of its next
 * pending reminder, for the bell of the row (add-reminders design.md D6). Only
 * the list carries it; creating or editing a task answers with the plain row,
 * so no mutation pays an extra query for a label.
 */
export type ListedTask = Task & { next_reminder_at: number | null };

/**
 * One index seek per task on `(task_id, status, remind_at)`.
 *
 * Written with qualified names on purpose: Drizzle renders `${tasks.id}` as a
 * bare `"id"` in a single-table select, and inside this subquery a bare `"id"`
 * resolves to **`reminders.id`**. The query would not fail; it would quietly
 * answer `null` for every task. The test of `next_reminder_at` is the one that
 * caught it.
 */
const nextReminderAt = sql<number | null>`(SELECT min("r"."remind_at") FROM "reminders" AS "r"
	WHERE "r"."task_id" = "tasks"."id" AND "r"."status" = 'pending')`.as("next_reminder_at");

const listedColumns = { ...getTableColumns(tasks), next_reminder_at: nextReminderAt };

export type ListTasksFilters = {
	/** Absent means the pending list, which is what the section shows. */
	status?: TaskStatus;
	/** Pending tasks whose day has already passed. */
	overdue?: boolean;
	timezone: string;
	/** Injected by the tests so "today" is a fixed day and not the day they run. */
	now?: number;
};

/**
 * The list, already ordered: `overdue` and the pending list go from soonest to
 * latest, and the completed ones from most recently completed to least.
 *
 * `now` decides only where today starts. The hour is never what classifies a
 * task, because `due_at` holds the 00:00 of its day: comparing against `now`
 * would make a task due today look overdue from 00:01 onwards, while the spec
 * says overdue means a day *earlier* than today.
 */
export async function listTasks(db: NexusDb, filters: ListTasksFilters): Promise<ListedTask[]> {
	const status = filters.status ?? "todo";
	const now = filters.now ?? Date.now();

	if (filters.overdue) {
		const startOfToday = zonedDayStart(new Date(now), filters.timezone);
		return db
			.select(listedColumns)
			.from(tasks)
			.where(and(eq(tasks.status, "todo"), isNotNull(tasks.due_at), lt(tasks.due_at, startOfToday)))
			.orderBy(asc(tasks.due_at), asc(tasks.created_at))
			.all();
	}

	return db
		.select(listedColumns)
		.from(tasks)
		.where(eq(tasks.status, status))
		.orderBy(
			// SQLite sorts NULL **first** on an ascending column, so without this
			// leading criterion the tasks without a date would sit above the overdue
			// ones and the list would open with what never expires. `0` (not null)
			// sorts before `1` (null), which puts the dates first.
			...(status === "done"
				? [desc(tasks.completed_at)]
				: [sql`${tasks.due_at} is null`, asc(tasks.due_at), asc(tasks.created_at)]),
		)
		.all();
}

export async function createTask(
	db: NexusDb,
	input: CreateTaskInput,
	timezone: string,
	now: number = Date.now(),
): Promise<Task> {
	const inserted = await db
		.insert(tasks)
		.values({
			id: crypto.randomUUID(),
			title: input.title,
			notes: input.notes ?? null,
			// A task is born pending and with no completion instant. Those are facts
			// of the model, not something the caller can choose.
			status: "todo",
			priority: input.priority ?? "medium",
			due_at: input.due_date ? dueDateToEpochMs(input.due_date, timezone) : null,
			completed_at: null,
			created_at: now,
			updated_at: now,
		})
		.returning();

	return single(inserted, "insert");
}

/**
 * Updates only the columns present in the patch and returns the new row, or
 * `null` when no task has that id.
 *
 * An absent key is left out of the `SET` entirely, which is what keeps the notes
 * when the title is edited. `RETURNING` is what turns "does it exist?" into the
 * same query as the write: in SQLite it returns the rows that matched the
 * `WHERE`, whether or not their values changed, so an edit that repeats the
 * current state answers with the row instead of a `404`.
 */
export async function updateTask(
	db: NexusDb,
	id: string,
	patch: UpdateTaskInput,
	timezone: string,
	now: number = Date.now(),
): Promise<Task | null> {
	const values: Partial<typeof tasks.$inferInsert> = {};

	if (patch.title !== undefined) {
		values.title = patch.title;
	}
	if (patch.notes !== undefined) {
		values.notes = patch.notes;
	}
	if (patch.priority !== undefined) {
		values.priority = patch.priority;
	}
	if (patch.due_date !== undefined) {
		values.due_at = patch.due_date ? dueDateToEpochMs(patch.due_date, timezone) : null;
	}

	// Nothing to change means no write at all: not even the `updated_at`.
	if (Object.keys(values).length === 0) {
		const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
		return existing ?? null;
	}

	values.updated_at = now;

	const updated = await db.update(tasks).set(values).where(eq(tasks.id, id)).returning();
	return updated[0] ?? null;
}

/**
 * The one and only writer of `completed_at`.
 *
 * The whole point is the symmetry the spec asks for: completing a task that is
 * already completed must not move the instant. `COALESCE` is what makes the
 * first completion the one that counts, and the `ELSE` leaves the behaviour
 * defined for any other value of `status`, so adding a path that changes the
 * state later cannot silently corrupt the column.
 */
export async function updateTaskStatus(
	db: NexusDb,
	id: string,
	status: TaskStatus,
	now: number = Date.now(),
): Promise<Task | null> {
	const completedAt = sql<number | null>`CASE
		WHEN ${status} = 'done' THEN COALESCE(${tasks.completed_at}, ${now})
		WHEN ${status} = 'todo' THEN NULL
		ELSE ${tasks.completed_at}
	END`;

	const updateTask = db
		.update(tasks)
		.set({ status, completed_at: completedAt, updated_at: now })
		.where(eq(tasks.id, id))
		.returning();

	if (status !== "done") {
		// Undoing never brings reminders back (add-reminders design.md D5).
		const updated = await updateTask;
		return updated[0] ?? null;
	}

	// Completing cancels the pending reminders in the same batch, which D1 runs
	// as one transaction: there is no moment in which the task is done and one
	// of its reminders can still be sent.
	const [updated] = await db.batch([
		updateTask,
		db
			.update(reminders)
			.set({ status: "cancelled" })
			.where(and(eq(reminders.task_id, id), eq(reminders.status, "pending"))),
	]);
	return updated[0] ?? null;
}

/**
 * Permanent, with no trace left: no `deleted_at`, no tombstone. `false` means
 * there was no such task, which the route answers as `404` without asking
 * twice.
 */
export async function deleteTask(db: NexusDb, id: string): Promise<boolean> {
	// The reminders go first and explicitly: the foreign key cascades too, but
	// only while `PRAGMA foreign_keys` is on, and the spec promises this without
	// conditions (add-reminders design.md D1).
	const [, deleted] = await db.batch([
		db.delete(reminders).where(eq(reminders.task_id, id)),
		db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id }),
	]);
	return deleted.length > 0;
}

/** An `INSERT ... RETURNING` always comes back with its row; anything else is a bug. */
function single(rows: Task[], operation: string): Task {
	const [row] = rows;
	if (row === undefined) {
		throw new Error(`The ${operation} into tasks returned no row.`);
	}
	return row;
}
