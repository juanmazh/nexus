import { env } from "cloudflare:test";
import { epochMsToLocalDateTime } from "@shared/dates";
import type { hc, InferResponseType } from "hono/client";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppType } from "../app";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { reminders as remindersTable, tasks as tasksTable } from "../db/schema";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

/**
 * The HTTP contract of the reminders: every rule of the service mapped to its
 * status code and to the project's error shape. The rules themselves, with a
 * fixed clock, are in `services/reminders.test.ts`; here the clock is the real
 * one, so the times are written relative to it.
 */

const { app } = createApp({ getKey: testGetKey });
const db = createDb(env);
const TZ = "Europe/Madrid";

function bindings() {
	return { ...testEnv(), DB: env.DB, APP_TIMEZONE: TZ };
}

let token: string;

async function call(path: string, init: RequestInit & { session?: boolean } = {}) {
	const { session = true, ...rest } = init;
	return app.fetch(
		apiRequest(path, {
			...rest,
			...(session ? { token } : {}),
			headers: rest.body ? { "Content-Type": "application/json" } : undefined,
		}),
		bindings(),
	);
}

/** A wall-clock time of Madrid `hours` from now, as the native input writes it. */
function inHours(hours: number): string {
	return epochMsToLocalDateTime(Date.now() + hours * 3_600_000, TZ);
}

async function newTask(title = "Llamar al taller"): Promise<string> {
	const res = await call("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
	return ((await res.json()) as { id: string }).id;
}

async function addReminder(taskId: string, remindAt: string) {
	return call(`/api/tasks/${taskId}/reminders`, {
		method: "POST",
		body: JSON.stringify({ remind_at: remindAt }),
	});
}

type RemindersClient = ReturnType<typeof hc<AppType, "/">>["api"]["tasks"][":id"]["reminders"];
type CreateResponse = InferResponseType<RemindersClient["$post"], 201>;

beforeAll(async () => {
	await setUpAccessKeys();
	token = await signAccessToken();
});

beforeEach(async () => {
	await db.delete(remindersTable);
	await db.delete(tasksTable);
});

describe("the typed contract", () => {
	it("derives the reminder from AppType", () => {
		const derived: CreateResponse extends { id: string; remind_at: number; status: string }
			? true
			: never = true;
		expect(derived).toBe(true);
	});
});

describe("POST /api/tasks/:id/reminders", () => {
	it("answers 201 with the reminder, pending, at the UTC instant of that wall-clock time", async () => {
		const taskId = await newTask();
		const remindAt = inHours(2);

		const res = await addReminder(taskId, remindAt);
		const body = (await res.json()) as { remind_at: number; status: string; task_id: string };

		expect(res.status).toBe(201);
		expect(body).toMatchObject({ task_id: taskId, status: "pending" });
		expect(epochMsToLocalDateTime(body.remind_at, TZ)).toBe(remindAt);
	});

	it.each([
		[{}, "Indica la fecha y la hora del aviso."],
		[{ remind_at: "mañana" }, "La hora del aviso tiene que tener el formato AAAA-MM-DDTHH:mm."],
		[{ remind_at: "2030-02-31T10:00" }, "Esa fecha u hora no existe en el calendario."],
		[{ remind_at: "2030-03-31T02:30" }, "Esa hora no existe ese día por el cambio de hora."],
		[{ remind_at: "2020-01-01T10:00" }, "Esa hora ya ha pasado."],
	])("answers 400 with the project's shape for %j", async (body, message) => {
		const taskId = await newTask();

		const res = await call(`/api/tasks/${taskId}/reminders`, {
			method: "POST",
			body: JSON.stringify(body),
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: { code: "validation_error", message } });
	});

	it("answers 201 with the repetition, and lists it with the pending ones", async () => {
		const taskId = await newTask();

		const res = await call(`/api/tasks/${taskId}/reminders`, {
			method: "POST",
			body: JSON.stringify({ remind_at: inHours(2), repeat: { every: 3, unit: "hours" } }),
		});
		const list = await call(`/api/tasks/${taskId}/reminders`);

		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ repeat_every: 3, repeat_unit: "hours" });
		expect(await list.json()).toEqual([
			expect.objectContaining({ repeat_every: 3, repeat_unit: "hours", status: "pending" }),
		]);
	});

	it("leaves the repetition empty on a one-off reminder", async () => {
		const res = await addReminder(await newTask(), inHours(2));

		expect(await res.json()).toMatchObject({ repeat_every: null, repeat_unit: null });
	});

	it.each([
		[{ every: 0, unit: "hours" }, "El intervalo mínimo es 1."],
		[{ every: 1.5, unit: "hours" }, "El intervalo tiene que ser un número entero."],
		[{ every: 721, unit: "hours" }, "Como mucho cada 720 horas o cada 30 días."],
		[{ every: 31, unit: "days" }, "Como mucho cada 720 horas o cada 30 días."],
		[{ every: 2, unit: "minutes" }, "La unidad solo puede ser horas o días."],
	])("answers 400 for the repetition %j", async (repeat, message) => {
		const taskId = await newTask();

		const res = await call(`/api/tasks/${taskId}/reminders`, {
			method: "POST",
			body: JSON.stringify({ remind_at: inHours(2), repeat }),
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: { code: "validation_error", message } });
	});

	it("answers 400 for an unknown property instead of ignoring it", async () => {
		const taskId = await newTask();

		const res = await call(`/api/tasks/${taskId}/reminders`, {
			method: "POST",
			body: JSON.stringify({ remind_at: inHours(2), channel: "email" }),
		});

		expect(res.status).toBe(400);
	});

	it("answers 404 for a task that does not exist", async () => {
		const res = await addReminder(crypto.randomUUID(), inHours(2));

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: "not_found", message: "Esta tarea ya no existe." },
		});
	});

	it("answers 409 for a completed task", async () => {
		const taskId = await newTask();
		await call(`/api/tasks/${taskId}`, {
			method: "PATCH",
			body: JSON.stringify({ status: "done" }),
		});

		const res = await addReminder(taskId, inHours(2));

		expect(res.status).toBe(409);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe("task_completed");
	});

	it("answers 409 for the eleventh pending reminder of a task", async () => {
		const taskId = await newTask();
		for (let hour = 1; hour <= 10; hour++) {
			expect((await addReminder(taskId, inHours(hour))).status).toBe(201);
		}

		const res = await addReminder(taskId, inHours(11));

		expect(res.status).toBe(409);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"too_many_reminders",
		);
	});
});

describe("GET /api/tasks/:id/reminders", () => {
	it("answers 200 with the pending ones, soonest first", async () => {
		const taskId = await newTask();
		await addReminder(taskId, inHours(5));
		await addReminder(taskId, inHours(2));

		const res = await call(`/api/tasks/${taskId}/reminders`);
		const list = (await res.json()) as { remind_at: number }[];

		expect(res.status).toBe(200);
		expect(list.map((reminder) => epochMsToLocalDateTime(reminder.remind_at, TZ))).toEqual([
			inHours(2),
			inHours(5),
		]);
	});

	it("answers 200 with an empty list for a task without reminders, 404 for no task", async () => {
		const taskId = await newTask();

		expect(await (await call(`/api/tasks/${taskId}/reminders`)).json()).toEqual([]);
		expect((await call(`/api/tasks/${crypto.randomUUID()}/reminders`)).status).toBe(404);
	});
});

describe("DELETE /api/reminders/:id", () => {
	it("answers 204, and the reminder is no longer pending, also the second time", async () => {
		const taskId = await newTask();
		const { id } = (await (await addReminder(taskId, inHours(2))).json()) as { id: string };

		expect((await call(`/api/reminders/${id}`, { method: "DELETE" })).status).toBe(204);
		expect((await call(`/api/reminders/${id}`, { method: "DELETE" })).status).toBe(204);
		expect(await (await call(`/api/tasks/${taskId}/reminders`)).json()).toEqual([]);
	});

	it("answers 409 for a reminder that was already sent", async () => {
		const taskId = await newTask();
		const { id } = (await (await addReminder(taskId, inHours(2))).json()) as { id: string };
		await env.DB.prepare("UPDATE reminders SET status = 'sent' WHERE id = ?").bind(id).run();

		const res = await call(`/api/reminders/${id}`, { method: "DELETE" });

		expect(res.status).toBe(409);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"reminder_not_pending",
		);
	});

	it("answers 404 for a reminder that does not exist and 400 for an id that is not one", async () => {
		expect((await call(`/api/reminders/${crypto.randomUUID()}`, { method: "DELETE" })).status).toBe(
			404,
		);
		expect((await call("/api/reminders/1", { method: "DELETE" })).status).toBe(400);
	});
});

describe("the rules every route shares", () => {
	it("answers 401 without a session", async () => {
		const taskId = crypto.randomUUID();

		expect((await call(`/api/tasks/${taskId}/reminders`, { session: false })).status).toBe(401);
		expect(
			(await call(`/api/reminders/${taskId}`, { method: "DELETE", session: false })).status,
		).toBe(401);
	});

	it("answers 405 with Allow for a method a path does not take", async () => {
		const taskId = crypto.randomUUID();

		const onList = await call(`/api/tasks/${taskId}/reminders`, { method: "PUT" });
		const onOne = await call(`/api/reminders/${taskId}`, { method: "GET" });

		expect(onList.status).toBe(405);
		expect(onList.headers.get("Allow")).toBe("GET, POST");
		expect(onOne.status).toBe(405);
		expect(onOne.headers.get("Allow")).toBe("DELETE");
	});

	it("lists the next reminder with each task, and completing the task removes it", async () => {
		const taskId = await newTask();
		await addReminder(taskId, inHours(3));

		const before = (await (await call("/api/tasks")).json()) as {
			next_reminder_at: number | null;
		}[];
		await call(`/api/tasks/${taskId}`, {
			method: "PATCH",
			body: JSON.stringify({ status: "done" }),
		});
		const done = (await (await call("/api/tasks?status=done")).json()) as {
			next_reminder_at: number | null;
		}[];

		expect(before[0]?.next_reminder_at).not.toBeNull();
		expect(done[0]?.next_reminder_at).toBeNull();
	});
});
