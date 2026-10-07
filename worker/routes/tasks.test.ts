import { env } from "cloudflare:test";
import type { hc, InferResponseType } from "hono/client";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppType } from "../app";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { tasks as tasksTable } from "../db/schema";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

const { app } = createApp({ getKey: testGetKey });
const db = createDb(env);

/** The session bindings of the tests plus the real D1 of the pool. */
function bindings() {
	return { ...testEnv(), DB: env.DB, APP_TIMEZONE: "Europe/Madrid" };
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

function json(body: unknown): RequestInit {
	return { body: JSON.stringify(body) };
}

type TasksClient = ReturnType<typeof hc<AppType, "/">>["api"]["tasks"];
type ListResponse = InferResponseType<TasksClient["$get"], 200>;

beforeAll(async () => {
	await setUpAccessKeys();
	token = await signAccessToken();
});

beforeEach(async () => {
	await db.delete(tasksTable);
});

describe("the typed contract", () => {
	it("derives the list from AppType instead of a hand-written type", () => {
		const derived: ListResponse extends { id: string; title: string }[] ? true : never = true;
		expect(derived).toBe(true);
	});
});

describe("GET /api/tasks", () => {
	it("answers 200 with an empty list when there is nothing", async () => {
		const res = await call("/api/tasks");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("answers 400 with the project's shape for a filter value it does not know", async () => {
		const res = await call("/api/tasks?overdue=no");

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: "validation_error", message: 'El filtro "overdue" solo admite true o false.' },
		});
	});

	it("does not list a task due today among the overdue ones", async () => {
		const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
			new Date(),
		);
		await call("/api/tasks", { method: "POST", ...json({ title: "Hoy", due_date: today }) });
		await call("/api/tasks", {
			method: "POST",
			...json({ title: "Hace un año", due_date: "2025-01-01" }),
		});

		const res = await call("/api/tasks?overdue=true");
		const list = (await res.json()) as { title: string }[];

		expect(list.map((task) => task.title)).toEqual(["Hace un año"]);
	});
});

describe("POST /api/tasks", () => {
	it("answers 201 with the task already normalized", async () => {
		const res = await call("/api/tasks", {
			method: "POST",
			...json({ title: "  Llamar al dentista " }),
		});
		const created = (await res.json()) as Record<string, unknown>;

		expect(res.status).toBe(201);
		expect(created).toMatchObject({
			title: "Llamar al dentista",
			status: "todo",
			priority: "medium",
			due_at: null,
			completed_at: null,
		});
	});

	it("answers 400 to a blank title and creates nothing", async () => {
		const res = await call("/api/tasks", { method: "POST", ...json({ title: "   " }) });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: "validation_error", message: "Escribe un título para la tarea." },
		});
		expect(await (await call("/api/tasks")).json()).toEqual([]);
	});

	it("answers 400 to a property it does not know", async () => {
		const res = await call("/api/tasks", {
			method: "POST",
			...json({ title: "Algo", status: "done" }),
		});

		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe("validation_error");
	});
});

describe("PATCH /api/tasks/:id", () => {
	async function create(title: string, extra: Record<string, unknown> = {}) {
		const res = await call("/api/tasks", { method: "POST", ...json({ title, ...extra }) });
		return (await res.json()) as { id: string; completed_at: number | null; notes: string | null };
	}

	it("edits only the fields it receives and keeps the notes", async () => {
		const task = await create("Original", { notes: "Notas" });

		const res = await call(`/api/tasks/${task.id}`, {
			method: "PATCH",
			...json({ title: "Cambiado" }),
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ title: "Cambiado", notes: "Notas" });
	});

	it("answers 200, not 404, when the edit repeats the current values", async () => {
		const task = await create("Igual");

		const res = await call(`/api/tasks/${task.id}`, {
			method: "PATCH",
			...json({ title: "Igual" }),
		});

		expect(res.status).toBe(200);
	});

	it("completes and undoes through the state, keeping the first completion instant", async () => {
		const task = await create("Pendiente");

		const done = (await (
			await call(`/api/tasks/${task.id}`, { method: "PATCH", ...json({ status: "done" }) })
		).json()) as { status: string; completed_at: number };
		const again = (await (
			await call(`/api/tasks/${task.id}`, { method: "PATCH", ...json({ status: "done" }) })
		).json()) as { completed_at: number };
		const undone = (await (
			await call(`/api/tasks/${task.id}`, { method: "PATCH", ...json({ status: "todo" }) })
		).json()) as { status: string; completed_at: number | null };

		expect(done.status).toBe("done");
		expect(typeof done.completed_at).toBe("number");
		expect(again.completed_at).toBe(done.completed_at);
		expect(undone).toMatchObject({ status: "todo", completed_at: null });
	});

	it("names the state when its value is not one of the allowed ones", async () => {
		const task = await create("Algo");

		const res = await call(`/api/tasks/${task.id}`, {
			method: "PATCH",
			...json({ status: "doing" }),
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: "validation_error", message: "El estado solo puede ser todo o done." },
		});
	});

	it("answers 404 for an id that matches nothing and creates nothing", async () => {
		const res = await call(`/api/tasks/${crypto.randomUUID()}`, {
			method: "PATCH",
			...json({ title: "Fantasma" }),
		});

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: "not_found", message: "Esta tarea ya no existe." },
		});
		expect(await (await call("/api/tasks")).json()).toEqual([]);
	});

	it("answers 400, not 500, for an id that is not a uuid", async () => {
		const res = await call("/api/tasks/no-es-un-id", {
			method: "PATCH",
			...json({ title: "Algo" }),
		});

		expect(res.status).toBe(400);
	});
});

describe("DELETE /api/tasks/:id", () => {
	it("answers 204 without a body and leaves no trace", async () => {
		const created = (await (
			await call("/api/tasks", { method: "POST", ...json({ title: "Efímera" }) })
		).json()) as { id: string };

		const res = await call(`/api/tasks/${created.id}`, { method: "DELETE" });

		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
		expect(await (await call("/api/tasks")).json()).toEqual([]);
	});

	it("answers 404 for an id that matches nothing", async () => {
		const res = await call(`/api/tasks/${crypto.randomUUID()}`, { method: "DELETE" });

		expect(res.status).toBe(404);
	});
});

describe("the rules every route of /api/tasks shares", () => {
	it("answers 401 without a session and touches nothing", async () => {
		const res = await call("/api/tasks", {
			method: "POST",
			session: false,
			...json({ title: "Intrusa" }),
		});

		expect(res.status).toBe(401);
		expect(await (await call("/api/tasks")).json()).toEqual([]);
	});

	it("answers 405 with Allow for a method a path does not take", async () => {
		const list = await call("/api/tasks", { method: "PUT" });
		const item = await call(`/api/tasks/${crypto.randomUUID()}`, { method: "GET" });

		expect(list.status).toBe(405);
		expect(list.headers.get("Allow")).toBe("GET, POST");
		expect(item.status).toBe(405);
		expect(item.headers.get("Allow")).toBe("PATCH, DELETE");
		expect(((await list.json()) as { error: { code: string } }).error.code).toBe(
			"method_not_allowed",
		);
	});

	it("carries the security headers on its answers too", async () => {
		const res = await call("/api/tasks");

		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
	});
});
