import { env } from "cloudflare:test";
import { createTaskSchema } from "@shared/tasks";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { tasks } from "../db/schema";
import * as taskService from "./tasks";

/**
 * Against the real D1 of the Cloudflare pool, not against `testEnv()` and not
 * against a double: `NULL` sorting before every number, `RETURNING` returning
 * the rows that matched rather than the rows that changed, and integers coming
 * back as numbers instead of text are all things only SQLite decides, and all
 * of them are exactly what these tests are for.
 *
 * `now` is injected everywhere so "today" is a fixed day.
 */

const TZ = "Europe/Madrid";

/** 2026-10-07T16:00:00Z, which is 18:00 in Madrid: a plain Wednesday evening. */
const NOW = Date.UTC(2026, 9, 7, 16, 0, 0);
/** 2026-10-07T22:00:00Z is the start of that same day in Madrid. */
const TODAY_START = Date.UTC(2026, 9, 6, 22, 0, 0);

const db = createDb(env);

/** 2026-10-05T22:00:00Z, two days before today, at its own midnight. */
const TWO_DAYS_AGO = Date.UTC(2026, 9, 4, 22, 0, 0);
/** 2026-10-10T22:00:00Z, three days from now. */
const IN_THREE_DAYS = Date.UTC(2026, 9, 9, 22, 0, 0);

async function emptyTable(): Promise<void> {
	await db.delete(tasks);
}

async function insertTask(overrides: Partial<typeof tasks.$inferInsert> = {}) {
	const [row] = await db
		.insert(tasks)
		.values({
			id: crypto.randomUUID(),
			title: "Una tarea",
			status: "todo",
			priority: "medium",
			created_at: NOW,
			updated_at: NOW,
			...overrides,
		})
		.returning();
	if (!row) {
		throw new Error("the insert under test returned no row");
	}
	return row;
}

/** Titles in list order, which is what every ordering assertion looks at. */
async function titles(filters: Partial<taskService.ListTasksFilters>): Promise<string[]> {
	const list = await taskService.listTasks(db, { timezone: TZ, now: NOW, ...filters });
	return list.map((task) => task.title);
}

beforeEach(emptyTable);

describe("listTasks", () => {
	it("returns only the pending tasks when no filter is given", async () => {
		await insertTask({ title: "Pendiente" });
		const done = await insertTask({ title: "Hecha", status: "done", completed_at: NOW });

		const list = await taskService.listTasks(db, { timezone: TZ, now: NOW });

		expect(list.map((task) => task.id)).toEqual([expect.not.stringMatching(done.id)]);
		expect(list.map((task) => task.title)).toEqual(["Pendiente"]);
	});

	it("puts the tasks without a date last, not first", async () => {
		await insertTask({ title: "Sin fecha" });
		await insertTask({ title: "Mañana", due_at: IN_THREE_DAYS });
		await insertTask({ title: "Hoy", due_at: TODAY_START });
		await insertTask({ title: "Vencida", due_at: TWO_DAYS_AGO });

		expect(await titles({})).toEqual(["Vencida", "Hoy", "Mañana", "Sin fecha"]);
	});

	it("breaks a tie on the same date by the oldest task first", async () => {
		await insertTask({ title: "Segunda", due_at: TODAY_START, created_at: NOW });
		await insertTask({ title: "Primera", due_at: TODAY_START, created_at: NOW - 60_000 });

		expect(await titles({})).toEqual(["Primera", "Segunda"]);
	});

	it("orders the completed tasks by most recently completed first", async () => {
		await insertTask({ title: "Hecha antes", status: "done", completed_at: NOW - 86_400_000 });
		await insertTask({ title: "Hecha ahora", status: "done", completed_at: NOW });

		expect(await titles({ status: "done" })).toEqual(["Hecha ahora", "Hecha antes"]);
	});

	it("filters by state, in both directions", async () => {
		await insertTask({ title: "Pendiente" });
		await insertTask({ title: "Hecha", status: "done", completed_at: NOW });

		expect(await titles({ status: "todo" })).toEqual(["Pendiente"]);
		expect(await titles({ status: "done" })).toEqual(["Hecha"]);
	});

	it("returns the overdue ones and nothing else", async () => {
		await insertTask({ title: "Sin fecha" });
		await insertTask({ title: "Hoy", due_at: TODAY_START });
		await insertTask({ title: "Vencida", due_at: TWO_DAYS_AGO });

		expect(await titles({ overdue: true })).toEqual(["Vencida"]);
	});

	it("does not call a task due today overdue, however late it is", async () => {
		// 18:00 Madrid, and `due_at` is that day's midnight: the spec's own case.
		await insertTask({ title: "Vence hoy a las 09:00", due_at: TODAY_START });

		expect(await titles({ overdue: true })).toEqual([]);
		expect(await titles({})).toEqual(["Vence hoy a las 09:00"]);
	});

	it("never returns a completed task as overdue, even with a past date", async () => {
		await insertTask({
			title: "Hecha y vencida",
			status: "done",
			completed_at: NOW,
			due_at: TWO_DAYS_AGO,
		});

		expect(await titles({ overdue: true })).toEqual([]);
	});

	it("treats the previous day as overdue and the next one as not", async () => {
		await insertTask({ title: "Ayer", due_at: TODAY_START - 86_400_000 });
		await insertTask({ title: "Hoy", due_at: TODAY_START });
		await insertTask({ title: "Mañana", due_at: TODAY_START + 86_400_000 });

		expect(await titles({ overdue: true })).toEqual(["Ayer"]);
	});

	it("answers an empty list instead of failing when nothing matches", async () => {
		expect(await titles({})).toEqual([]);
		expect(await titles({ status: "done" })).toEqual([]);
		expect(await titles({ overdue: true })).toEqual([]);
	});
});

describe("createTask", () => {
	it("gives a task created from only a title the documented defaults", async () => {
		// The route hands the service what the shared schema already parsed.
		const input = createTaskSchema.parse({ title: "  Llamar al dentista  " });
		const created = await taskService.createTask(db, input, TZ, NOW);

		expect(created.title).toBe("Llamar al dentista");
		expect(created.status).toBe("todo");
		expect(created.priority).toBe("medium");
		expect(created.due_at).toBeNull();
		expect(created.completed_at).toBeNull();
		expect(created.created_at).toBe(NOW);
		expect(created.updated_at).toBe(NOW);
		expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("keeps the notes, the priority and the due date it is given", async () => {
		const created = await taskService.createTask(
			db,
			{
				title: "Preparar la reunión",
				notes: "Con el equipo",
				priority: "high",
				due_date: "2026-10-10",
			},
			TZ,
			NOW,
		);

		expect(created.notes).toBe("Con el equipo");
		expect(created.priority).toBe("high");
		// 00:00 in Madrid on that day, which is 22:00 UTC of the day before.
		expect(created.due_at).toBe(IN_THREE_DAYS);
	});

	it("never lets the caller set the state or the completion instant", async () => {
		const created = await taskService.createTask(
			db,
			{ title: "Algo", priority: "high" } as never,
			TZ,
			NOW,
		);

		expect(created.status).toBe("todo");
		expect(created.completed_at).toBeNull();
	});
});

describe("updateTask", () => {
	it("returns the row when the patch repeats the values it already had", async () => {
		const task = await insertTask({ title: "Igual", priority: "low" });

		const updated = await taskService.updateTask(
			db,
			task.id,
			{ title: "Igual", priority: "low" },
			TZ,
			NOW,
		);

		// D6: `RETURNING` gives back the rows that matched, so a no-op edit is not
		// a "no existe" and never has to ask the database a second time.
		expect(updated?.id).toBe(task.id);
		expect(updated?.title).toBe("Igual");
	});

	it("changes only the fields the patch carries", async () => {
		const task = await insertTask({ title: "Original", notes: "Notas", priority: "low" });

		const updated = await taskService.updateTask(
			db,
			task.id,
			{ title: "Cambiado" },
			TZ,
			NOW + 5_000,
		);

		expect(updated?.title).toBe("Cambiado");
		expect(updated?.notes).toBe("Notas");
		expect(updated?.priority).toBe("low");
		expect(updated?.updated_at).toBe(NOW + 5_000);
	});

	it("clears the notes when they are sent explicitly", async () => {
		const task = await insertTask({ title: "Con notas", notes: "Algo" });

		const updated = await taskService.updateTask(db, task.id, { notes: null }, TZ, NOW);

		expect(updated?.notes).toBeNull();
	});

	it("clears the due date when it is sent explicitly", async () => {
		const task = await insertTask({ title: "Con fecha", due_at: IN_THREE_DAYS });

		const updated = await taskService.updateTask(db, task.id, { due_date: null }, TZ, NOW);

		expect(updated?.due_at).toBeNull();
	});

	it("moves the task to the section its new date belongs to", async () => {
		await insertTask({ title: "Ahora sí vencida", due_at: TWO_DAYS_AGO });
		const task = await insertTask({ title: "Pasada a hoy", due_at: TWO_DAYS_AGO });

		await taskService.updateTask(db, task.id, { due_date: "2026-10-07" }, TZ, NOW);

		expect(await titles({ overdue: true })).toEqual(["Ahora sí vencida"]);
	});

	it("never touches the state or the completion instant", async () => {
		const task = await insertTask({
			title: "Hecha",
			status: "done",
			completed_at: NOW - 1_000,
		});

		const updated = await taskService.updateTask(
			db,
			task.id,
			{ title: "Hecha y editada" },
			TZ,
			NOW,
		);

		expect(updated?.status).toBe("done");
		expect(updated?.completed_at).toBe(NOW - 1_000);
	});

	it("writes nothing when the patch is empty", async () => {
		const task = await insertTask({ title: "Sin tocar" });

		const updated = await taskService.updateTask(db, task.id, {}, TZ, NOW + 60_000);

		expect(updated?.updated_at).toBe(NOW);
	});

	it("reports that the task does not exist, so the route can answer 404", async () => {
		const updated = await taskService.updateTask(
			db,
			crypto.randomUUID(),
			{ title: "Fantasma" },
			TZ,
			NOW,
		);

		expect(updated).toBeNull();
	});

	it("does not create a task out of an id that matches nothing", async () => {
		const id = crypto.randomUUID();
		await taskService.updateTask(db, id, { title: "Fantasma" }, TZ, NOW);

		const [row] = await db.select({ total: sql<number>`count(*)` }).from(tasks);
		expect(row?.total).toBe(0);
	});
});

describe("updateTaskStatus", () => {
	it("records the completion instant when a task is completed", async () => {
		const task = await insertTask({ title: "Pendiente" });

		const done = await taskService.updateTaskStatus(db, task.id, "done", NOW);

		expect(done?.status).toBe("done");
		expect(done?.completed_at).toBe(NOW);
	});

	it("does not move the instant when it is completed a second time", async () => {
		const task = await insertTask({ title: "Pendiente" });

		const first = await taskService.updateTaskStatus(db, task.id, "done", NOW);
		const second = await taskService.updateTaskStatus(db, task.id, "done", NOW + 60_000);

		expect(first?.completed_at).toBe(NOW);
		expect(second?.completed_at).toBe(NOW);
		// The modification stamp does move: something did happen.
		expect(second?.updated_at).toBe(NOW + 60_000);
	});

	it("empties the instant when the task goes back to pending", async () => {
		const task = await insertTask({ title: "Hecha", status: "done", completed_at: NOW - 1_000 });

		const undone = await taskService.updateTaskStatus(db, task.id, "todo", NOW);

		expect(undone?.status).toBe("todo");
		expect(undone?.completed_at).toBeNull();
	});

	it("round-trips without losing anything else", async () => {
		const task = await insertTask({
			title: "Con todo",
			notes: "Notas",
			priority: "high",
			due_at: IN_THREE_DAYS,
		});

		await taskService.updateTaskStatus(db, task.id, "done", NOW);
		const undone = await taskService.updateTaskStatus(db, task.id, "todo", NOW + 1_000);

		expect(undone?.title).toBe("Con todo");
		expect(undone?.notes).toBe("Notas");
		expect(undone?.priority).toBe("high");
		expect(undone?.due_at).toBe(IN_THREE_DAYS);
	});

	it("reports that the task does not exist", async () => {
		expect(await taskService.updateTaskStatus(db, crypto.randomUUID(), "done", NOW)).toBeNull();
	});
});

describe("deleteTask", () => {
	it("says it deleted something that existed, and it leaves no trace", async () => {
		const task = await insertTask({ title: "Efímera" });

		expect(await taskService.deleteTask(db, task.id)).toBe(true);
		expect(await taskService.listTasks(db, { timezone: TZ, now: NOW })).toEqual([]);
		expect(await taskService.updateTask(db, task.id, { title: "Resucitada" }, TZ, NOW)).toBeNull();
	});

	it("says it did not exist, so the route can answer 404", async () => {
		expect(await taskService.deleteTask(db, crypto.randomUUID())).toBe(false);
	});

	it("deletes only the task it was given", async () => {
		const task = await insertTask({ title: "Se va" });
		await insertTask({ title: "Se queda" });

		await taskService.deleteTask(db, task.id);

		expect(await titles({})).toEqual(["Se queda"]);
	});
});
