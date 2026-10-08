import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { reminders, tasks } from "../db/schema";
import * as reminderService from "./reminders";

/**
 * Against the real D1 of the pool, like the task service. `now` is fixed at
 * Wednesday 2026-10-07, 18:00 in Madrid, and every wall-clock time below is
 * written as the person would pick it.
 */

const TZ = "Europe/Madrid";
const NOW = Date.UTC(2026, 9, 7, 16, 0);
const db = createDb(env);

async function insertTask(status: "todo" | "done" = "todo") {
	const id = crypto.randomUUID();
	await db
		.insert(tasks)
		.values({ id, title: "Llamar al taller", status, created_at: NOW, updated_at: NOW });
	return id;
}

async function insertReminder(
	taskId: string,
	status: "pending" | "sent" | "failed" | "cancelled",
	remindAt = NOW + 3_600_000,
) {
	const id = crypto.randomUUID();
	await db
		.insert(reminders)
		.values({ id, task_id: taskId, remind_at: remindAt, status, created_at: NOW });
	return id;
}

async function statusOf(id: string) {
	const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
	return row?.status;
}

beforeEach(async () => {
	await db.delete(reminders);
	await db.delete(tasks);
});

describe("createReminder", () => {
	it("stores the wall-clock time of Madrid as UTC, pending and with no attempts", async () => {
		const taskId = await insertTask();

		const result = await reminderService.createReminder(db, taskId, "2026-10-08T09:00", TZ, NOW);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.reminder).toMatchObject({
			task_id: taskId,
			remind_at: Date.UTC(2026, 9, 8, 7, 0),
			channel: "telegram",
			status: "pending",
			attempts: 0,
			last_error: null,
			sent_at: null,
			created_at: NOW,
		});
	});

	it("rejects a time that has already passed, including this very minute", async () => {
		const taskId = await insertTask();

		expect(await reminderService.createReminder(db, taskId, "2026-10-07T17:59", TZ, NOW)).toEqual({
			ok: false,
			reason: "past",
		});
		expect(await reminderService.createReminder(db, taskId, "2026-10-07T18:00", TZ, NOW)).toEqual({
			ok: false,
			reason: "past",
		});
	});

	it("tells a malformed value from an hour that the clocks skip", async () => {
		const taskId = await insertTask();
		const before = Date.UTC(2026, 2, 1);

		expect(
			await reminderService.createReminder(db, taskId, "2026-02-31T10:00", TZ, before),
		).toEqual({ ok: false, reason: "invalid" });
		expect(
			await reminderService.createReminder(db, taskId, "2026-03-29T02:30", TZ, before),
		).toEqual({ ok: false, reason: "nonexistent" });
	});

	it("checks the time before looking for the task", async () => {
		expect(
			await reminderService.createReminder(db, crypto.randomUUID(), "2026-10-07T10:00", TZ, NOW),
		).toEqual({ ok: false, reason: "past" });
	});

	it("reports a task that does not exist and one that is already done", async () => {
		const done = await insertTask("done");

		expect(
			await reminderService.createReminder(db, crypto.randomUUID(), "2026-10-08T09:00", TZ, NOW),
		).toEqual({ ok: false, reason: "task_not_found" });
		expect(await reminderService.createReminder(db, done, "2026-10-08T09:00", TZ, NOW)).toEqual({
			ok: false,
			reason: "task_completed",
		});
	});

	it("stops at 10 pending reminders, counting only the pending ones", async () => {
		const taskId = await insertTask();
		await insertReminder(taskId, "sent");
		await insertReminder(taskId, "cancelled");
		for (let index = 0; index < 9; index++) {
			await insertReminder(taskId, "pending");
		}

		const tenth = await reminderService.createReminder(db, taskId, "2026-10-08T09:00", TZ, NOW);
		const eleventh = await reminderService.createReminder(db, taskId, "2026-10-08T10:00", TZ, NOW);

		expect(tenth.ok).toBe(true);
		expect(eleventh).toEqual({ ok: false, reason: "too_many" });
	});
});

describe("listPendingReminders", () => {
	it("returns only the pending ones of that task, soonest first", async () => {
		const taskId = await insertTask();
		const other = await insertTask();
		const late = await insertReminder(taskId, "pending", NOW + 2 * 3_600_000);
		const early = await insertReminder(taskId, "pending", NOW + 3_600_000);
		await insertReminder(taskId, "sent");
		await insertReminder(other, "pending");

		const list = await reminderService.listPendingReminders(db, taskId);

		expect(list?.map((reminder) => reminder.id)).toEqual([early, late]);
	});

	it("answers an empty list for a task without reminders and null for no task", async () => {
		const taskId = await insertTask();

		expect(await reminderService.listPendingReminders(db, taskId)).toEqual([]);
		expect(await reminderService.listPendingReminders(db, crypto.randomUUID())).toBeNull();
	});
});

describe("cancelReminder", () => {
	it("cancels a pending reminder without deleting it", async () => {
		const id = await insertReminder(await insertTask(), "pending");

		expect(await reminderService.cancelReminder(db, id)).toBe("cancelled");
		expect(await statusOf(id)).toBe("cancelled");
	});

	it("answers the same when it is cancelled twice", async () => {
		const id = await insertReminder(await insertTask(), "cancelled");

		expect(await reminderService.cancelReminder(db, id)).toBe("cancelled");
	});

	it("refuses to cancel one that was already sent or failed, and leaves it alone", async () => {
		const taskId = await insertTask();
		const sent = await insertReminder(taskId, "sent");
		const failed = await insertReminder(taskId, "failed");

		expect(await reminderService.cancelReminder(db, sent)).toBe("not_pending");
		expect(await reminderService.cancelReminder(db, failed)).toBe("not_pending");
		expect(await statusOf(sent)).toBe("sent");
		expect(await statusOf(failed)).toBe("failed");
	});

	it("reports a reminder that does not exist", async () => {
		expect(await reminderService.cancelReminder(db, crypto.randomUUID())).toBe("not_found");
	});
});
