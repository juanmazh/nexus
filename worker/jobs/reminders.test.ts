import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../db/client";
import { reminders, tasks } from "../db/schema";
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
});
