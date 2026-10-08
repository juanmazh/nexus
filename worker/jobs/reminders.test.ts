import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../db/client";
import { reminders, settings, tasks } from "../db/schema";
import { runReminders } from "./reminders";

/**
 * The job against the real D1 of the pool and a simulated Telegram. `now` is
 * fixed, so "due" means `remind_at <= NOW` and nothing depends on when the
 * suite runs.
 */

const NOW = Date.UTC(2026, 9, 7, 16, 0);
const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijk";
const db = createDb(env);

function jobEnv(overrides: Record<string, string | undefined> = {}) {
	return {
		DB: env.DB,
		APP_TIMEZONE: "Europe/Madrid",
		TELEGRAM_BOT_TOKEN: TOKEN,
		TELEGRAM_CHAT_ID: "424242",
		...overrides,
	};
}

const telegramOk = () =>
	vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

const telegramDown = () =>
	vi.fn(async () => {
		throw new Error(`connect ECONNREFUSED https://api.telegram.org/bot${TOKEN}/sendMessage`);
	}) as typeof fetch;

async function insertTask(title = "Llamar al taller") {
	const id = crypto.randomUUID();
	await db.insert(tasks).values({ id, title, created_at: NOW, updated_at: NOW });
	return id;
}

async function insertReminder(
	taskId: string,
	overrides: Partial<typeof reminders.$inferInsert> = {},
) {
	const id = crypto.randomUUID();
	await db.insert(reminders).values({
		id,
		task_id: taskId,
		remind_at: NOW - 60_000,
		created_at: NOW - 3_600_000,
		...overrides,
	});
	return id;
}

async function rowOf(id: string) {
	const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
	return row;
}

beforeEach(async () => {
	await db.delete(reminders);
	await db.delete(tasks);
	await db.delete(settings);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runReminders", () => {
	it("sends a due reminder and marks it sent at that instant", async () => {
		const id = await insertReminder(await insertTask("Pagar el alquiler"));
		const fetchImpl = telegramOk();

		const result = await runReminders(jobEnv(), NOW, fetchImpl);

		expect(result).toEqual({ status: "done", sent: 1, retrying: 0, failed: 0 });
		expect(await rowOf(id)).toMatchObject({ status: "sent", sent_at: NOW, attempts: 0 });
		const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body));
		expect(body.text).toBe("⏰ Pagar el alquiler");
	});

	it("keeps a failed one pending with one attempt and the error, then retries it", async () => {
		const id = await insertReminder(await insertTask());

		await runReminders(jobEnv(), NOW, telegramDown());
		const afterFirst = await rowOf(id);
		await runReminders(jobEnv(), NOW + 300_000, telegramOk());

		expect(afterFirst).toMatchObject({ status: "pending", attempts: 1 });
		expect(afterFirst?.last_error).toContain("Error de red");
		expect(await rowOf(id)).toMatchObject({ status: "sent", last_error: null });
	});

	it("gives up on the third failure", async () => {
		const id = await insertReminder(await insertTask(), { attempts: 2 });

		const result = await runReminders(jobEnv(), NOW, telegramDown());

		expect(result).toEqual({ status: "done", sent: 0, retrying: 0, failed: 1 });
		expect(await rowOf(id)).toMatchObject({ status: "failed", attempts: 3 });
	});

	it("never stores the token in the error", async () => {
		const id = await insertReminder(await insertTask());

		await runReminders(jobEnv(), NOW, telegramDown());

		const row = await rowOf(id);
		expect(row?.last_error).not.toContain(TOKEN);
		expect(row?.last_error?.length).toBeLessThanOrEqual(500);
	});

	it("sends the 20 oldest of 25 and leaves 5 for the next run", async () => {
		const taskId = await insertTask();
		const ids: string[] = [];
		for (let index = 0; index < 25; index++) {
			ids.push(await insertReminder(taskId, { remind_at: NOW - (25 - index) * 60_000 }));
		}
		const fetchImpl = telegramOk();

		await runReminders(jobEnv(), NOW, fetchImpl);

		expect(fetchImpl).toHaveBeenCalledTimes(20);
		const statuses = await Promise.all(ids.map(async (id) => (await rowOf(id))?.status));
		expect(statuses.slice(0, 20).every((status) => status === "sent")).toBe(true);
		expect(statuses.slice(20).every((status) => status === "pending")).toBe(true);
	});

	it("ignores future, cancelled, sent and failed reminders", async () => {
		const taskId = await insertTask();
		await insertReminder(taskId, { remind_at: NOW + 60_000 });
		await insertReminder(taskId, { status: "cancelled" });
		await insertReminder(taskId, { status: "sent", sent_at: NOW - 60_000 });
		await insertReminder(taskId, { status: "failed", attempts: 3 });
		const fetchImpl = telegramOk();

		const result = await runReminders(jobEnv(), NOW, fetchImpl);

		expect(fetchImpl).not.toHaveBeenCalled();
		expect(result).toEqual({ status: "done", sent: 0, retrying: 0, failed: 0 });
	});

	it("touches nothing and names the missing secret when it is not configured", async () => {
		const id = await insertReminder(await insertTask());
		const fetchImpl = telegramOk();
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await runReminders(jobEnv({ TELEGRAM_BOT_TOKEN: undefined }), NOW, fetchImpl);

		expect(result).toEqual({ status: "not_configured", missing: ["TELEGRAM_BOT_TOKEN"] });
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ status: "pending", attempts: 0, last_error: null });
		expect(logged).toHaveBeenCalledWith(expect.stringContaining("TELEGRAM_BOT_TOKEN"));
		expect(logged).not.toHaveBeenCalledWith(expect.stringContaining(TOKEN));
	});

	it("does not send a reminder whose task is already done", async () => {
		// The race design.md D5 cannot close on its own: a reminder created in the
		// same instant the task was completed slips past the cancelling batch.
		const taskId = await insertTask();
		const id = await insertReminder(taskId);
		await db.update(tasks).set({ status: "done", completed_at: NOW }).where(eq(tasks.id, taskId));
		const fetchImpl = telegramOk();

		await runReminders(jobEnv(), NOW, fetchImpl);

		expect(fetchImpl).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ status: "pending", attempts: 0 });
	});
});

describe("runReminders with recurring reminders", () => {
	const HOUR = 3_600_000;
	const every2h = { repeat_every: 2, repeat_unit: "hours" as const };

	function textOf(fetchImpl: typeof fetch, call = 0): string {
		return JSON.parse(String(vi.mocked(fetchImpl).mock.calls[call]?.[1]?.body)).text;
	}

	it("sends it, says it repeats and moves it to its next occurrence instead of closing it", async () => {
		const id = await insertReminder(await insertTask("Beber agua"), every2h);
		const fetchImpl = telegramOk();

		const result = await runReminders(jobEnv(), NOW, fetchImpl);

		expect(result).toEqual({ status: "done", sent: 1, retrying: 0, failed: 0 });
		expect(textOf(fetchImpl)).toBe("🔁 No te olvides: Beber agua\nSe repite cada 2 h");
		expect(await rowOf(id)).toMatchObject({
			status: "pending",
			remind_at: NOW - 60_000 + 2 * HOUR,
			sent_at: NOW,
			attempts: 0,
			last_error: null,
		});
	});

	it("retries a failed send like a one-off reminder before giving up", async () => {
		const id = await insertReminder(await insertTask(), every2h);

		const result = await runReminders(jobEnv(), NOW, telegramDown());

		expect(result).toEqual({ status: "done", sent: 0, retrying: 1, failed: 0 });
		expect(await rowOf(id)).toMatchObject({
			status: "pending",
			remind_at: NOW - 60_000,
			attempts: 1,
		});
	});

	it("loses only that repetition on the third failure and keeps the error", async () => {
		const id = await insertReminder(await insertTask(), { ...every2h, attempts: 2 });

		const result = await runReminders(jobEnv(), NOW, telegramDown());

		expect(result).toEqual({ status: "done", sent: 0, retrying: 0, failed: 1 });
		const row = await rowOf(id);
		expect(row).toMatchObject({
			status: "pending",
			remind_at: NOW - 60_000 + 2 * HOUR,
			attempts: 0,
		});
		expect(row?.last_error).toContain("Error de red");
	});

	it("sends once after a long stop instead of a burst", async () => {
		// Ten hours without the job: ten occurrences were missed, one goes out.
		const remindAt = NOW - 10 * HOUR - 60_000;
		const id = await insertReminder(await insertTask(), {
			remind_at: remindAt,
			repeat_every: 1,
			repeat_unit: "hours",
		});
		const fetchImpl = telegramOk();

		await runReminders(jobEnv(), NOW, fetchImpl);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect((await rowOf(id))?.remind_at).toBe(NOW + HOUR - 60_000);
	});

	// 22:00 in Madrid every 2 h: the next one, 00:00, falls in the quiet hours.
	const LATE = Date.UTC(2026, 9, 7, 20, 0);

	it("moves an occurrence out of the default quiet hours, to 08:00", async () => {
		const id = await insertReminder(await insertTask(), { ...every2h, remind_at: LATE });

		await runReminders(jobEnv(), LATE + 60_000, telegramOk());

		expect((await rowOf(id))?.remind_at).toBe(Date.UTC(2026, 9, 8, 6, 0));
	});

	it("uses the quiet hours that were saved", async () => {
		await db.insert(settings).values({
			id: 1,
			quiet_start: "23:30",
			quiet_end: "07:00",
			updated_at: NOW,
		});
		const id = await insertReminder(await insertTask(), { ...every2h, remind_at: LATE });

		await runReminders(jobEnv(), LATE + 60_000, telegramOk());

		expect((await rowOf(id))?.remind_at).toBe(Date.UTC(2026, 9, 8, 5, 0));
	});

	it("goes off at night when the quiet hours are turned off", async () => {
		await db
			.insert(settings)
			.values({ id: 1, quiet_start: null, quiet_end: null, updated_at: NOW });
		const id = await insertReminder(await insertTask(), { ...every2h, remind_at: LATE });

		await runReminders(jobEnv(), LATE + 60_000, telegramOk());

		expect((await rowOf(id))?.remind_at).toBe(LATE + 2 * HOUR);
	});

	it("does not send nor move one whose task is already done", async () => {
		const taskId = await insertTask();
		const id = await insertReminder(taskId, every2h);
		await db.update(tasks).set({ status: "done", completed_at: NOW }).where(eq(tasks.id, taskId));
		const fetchImpl = telegramOk();

		await runReminders(jobEnv(), NOW, fetchImpl);

		expect(fetchImpl).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ status: "pending", remind_at: NOW - 60_000 });
	});
});
