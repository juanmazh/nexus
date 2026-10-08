import { localDateTimeToEpochMs } from "@shared/dates";
import type { RepeatUnit } from "@shared/recurrence";
import { MAX_PENDING_REMINDERS_PER_TASK } from "@shared/reminders";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NexusDb } from "../db/client";
import { reminders, tasks } from "../db/schema";

/**
 * The rules of a reminder, with no HTTP in sight. Every outcome the route has to
 * tell apart comes back as a value instead of an exception, so the translation
 * to `400`/`404`/`409` is a `switch` and not a `try` around a guess.
 */

export type Reminder = InferSelectModel<typeof reminders>;

export type CreateReminderResult =
	| { ok: true; reminder: Reminder }
	| {
			ok: false;
			reason: "invalid" | "nonexistent" | "past" | "task_not_found" | "task_completed" | "too_many";
	  };

/**
 * The pending reminders of one task, soonest first, or `null` when the task does
 * not exist. The second query only runs when the first comes back empty: a task
 * with reminders obviously exists.
 */
export async function listPendingReminders(
	db: NexusDb,
	taskId: string,
): Promise<Reminder[] | null> {
	const list = await db
		.select()
		.from(reminders)
		.where(and(eq(reminders.task_id, taskId), eq(reminders.status, "pending")))
		.orderBy(asc(reminders.remind_at))
		.all();

	if (list.length > 0) {
		return list;
	}
	const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
	return task ? [] : null;
}

/**
 * Checks in the order of design.md D3: the shape and the existence of the wall
 * clock time, that it is in the future, and then — in **one** query — that the
 * task exists, is pending and has room for another reminder.
 */
export async function createReminder(
	db: NexusDb,
	taskId: string,
	remindAt: string,
	timezone: string,
	now: number = Date.now(),
	/** Makes it recurring; `remindAt` is then its first occurrence. */
	repeat?: { every: number; unit: RepeatUnit },
): Promise<CreateReminderResult> {
	const parsed = localDateTimeToEpochMs(remindAt, timezone);
	if (!parsed.ok) {
		return { ok: false, reason: parsed.reason };
	}
	if (parsed.ms <= now) {
		return { ok: false, reason: "past" };
	}

	const [task] = await db
		.select({
			status: tasks.status,
			// Qualified by hand: Drizzle would write a bare `"id"`, which inside the
			// subquery means `reminders.id` (see `nextReminderAt` in services/tasks.ts).
			pending: sql<number>`(SELECT count(*) FROM "reminders" AS "r"
				WHERE "r"."task_id" = "tasks"."id" AND "r"."status" = 'pending')`,
		})
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.limit(1);

	if (!task) {
		return { ok: false, reason: "task_not_found" };
	}
	if (task.status === "done") {
		return { ok: false, reason: "task_completed" };
	}
	if (task.pending >= MAX_PENDING_REMINDERS_PER_TASK) {
		return { ok: false, reason: "too_many" };
	}

	const [reminder] = await db
		.insert(reminders)
		.values({
			id: crypto.randomUUID(),
			task_id: taskId,
			remind_at: parsed.ms,
			channel: "telegram",
			status: "pending",
			attempts: 0,
			created_at: now,
			repeat_every: repeat?.every ?? null,
			repeat_unit: repeat?.unit ?? null,
		})
		.returning();

	if (!reminder) {
		throw new Error("The insert into reminders returned no row.");
	}
	return { ok: true, reminder };
}

export type CancelReminderResult = "cancelled" | "not_found" | "not_pending";

/**
 * Pending → cancelled, and cancelled stays cancelled: the `WHERE` matches both,
 * so cancelling twice answers the same as cancelling once. Only when nothing
 * matched does a second query find out whether the reminder does not exist or
 * has already been sent or failed (design.md D4).
 */
export async function cancelReminder(db: NexusDb, id: string): Promise<CancelReminderResult> {
	const updated = await db
		.update(reminders)
		.set({ status: "cancelled" })
		.where(and(eq(reminders.id, id), inArray(reminders.status, ["pending", "cancelled"])))
		.returning({ id: reminders.id });

	if (updated.length > 0) {
		return "cancelled";
	}
	const [existing] = await db
		.select({ id: reminders.id })
		.from(reminders)
		.where(eq(reminders.id, id))
		.limit(1);
	return existing ? "not_pending" : "not_found";
}
